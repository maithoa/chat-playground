from unittest.mock import AsyncMock, MagicMock, patch
from unittest.mock import call

import pytest
import datetime
from fastapi import HTTPException, status
from starlette.requests import Request

from app.core.security import verify_rate_limit_and_quota, update_token_usage


def make_request(
    *,
    client=("127.0.0.1", 12345),
    session_id="session-123",
    device_fp="aabbgghtyuhjgddddertyuujt",
    headers_extra=None,
):
    headers = []
    if session_id is not None:
        headers.append((b"x-session-id", session_id.encode()))

    if device_fp is not None:
        headers.append((b"x-device-fp", device_fp.encode()))

    if headers_extra:
        for k, v in headers_extra.items():
            headers.append((k.encode(), v.encode()))

    return Request(
        {
            "type": "http",
            "headers": headers,
            "client": client,
        }
    )


@pytest.fixture(autouse=True)
def mock_settings():
    """Tự động mock settings cho mọi test case để chạy an toàn trên CI/CD (GitHub Actions)"""
    with patch("app.core.security.settings") as mock_set:
        mock_set.USER_MAX_REQS_PER_MIN = 10
        mock_set.USER_MAX_DAILY_TOKENS = 10000
        yield mock_set


@pytest.fixture
def redis_mock():
    pipe = MagicMock()
    pipe.execute = AsyncMock(return_value=[1, True])

    client = MagicMock()
    client.pipeline.return_value = pipe
    client.get = AsyncMock(return_value=None)

    pipe.__aenter__ = AsyncMock(return_value=pipe)
    pipe.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("app.core.security.redis_client", new=client),
        patch("app.core.security.time.time", return_value=120),
    ):
        yield client, pipe


@pytest.mark.asyncio
async def test_missing_client(redis_mock):
    client, _ = redis_mock
    request = make_request(client=None)

    with pytest.raises(HTTPException) as ex:
        await verify_rate_limit_and_quota(request)

    client.pipeline.assert_not_called()
    assert ex.value.status_code == 400
    assert ex.value.detail == "Missing client IP address."


@pytest.mark.asyncio
async def test_missing_device_fp(redis_mock):
    client, _ = redis_mock
    request = make_request(device_fp=None)

    with pytest.raises(HTTPException) as ex:
        await verify_rate_limit_and_quota(request)

    client.pipeline.assert_not_called()
    assert ex.value.status_code == 400
    assert ex.value.detail == "Missing x-device-fp in header."


@pytest.mark.asyncio
async def test_missing_session_id(redis_mock):
    client, _ = redis_mock
    request = make_request(session_id=None)

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(request)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Missing x-session-id in header."
    client.pipeline.assert_not_called()


@pytest.mark.asyncio
async def test_new_counter_allows_request(redis_mock):
    _, pipe = redis_mock
    pipe.execute.return_value = [1, True]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"

    expected_key = "rl:127.0.0.1:aabbgghtyuhjgddddertyuujt:2"

    pipe.incrby.assert_has_calls(
        [
            call("rl:127.0.0.1:aabbgghtyuhjgddddertyuujt:2", 1),
            call("rl:127.0.0.1:2", 1),
        ]
    )

    pipe.expire.assert_has_calls(
        [
            call("rl:127.0.0.1:aabbgghtyuhjgddddertyuujt:2", 172800),
            call("rl:127.0.0.1:2", 172800),
        ]
    )


@pytest.mark.asyncio
async def test_existing_counter_allows_request(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [
        10,
        30,  # device_used_requests, #30 ip_used_request
        0,
        0,  # device tokens, ip tokens
    ]

    pipe.execute.return_value = [10, True]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_exceeds_limit(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [
        11,
        30,  # device_used_requests, #30 ip_used_request
        0,
        0,  # device tokens, ip tokens
    ]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 429
    assert exc.value.detail == "Exceeded limit of 10 requests/min."
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_exceeds_limit_for_ipaddr(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [
        9,
        31,  # device_used_requests, #30 ip_used_request
        0,
        0,  # device tokens, ip tokens
    ]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 429
    assert exc.value.detail == "Exceeded limit of max requests/min for an IP address."
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_token_quota_exceeded(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [
        0,
        0,  # device_used_requests, #30 ip_used_request
        10000,
        20000,  # device tokens, ip tokens
    ]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Exceeded daily token quota" in exc.value.detail
    assert pipe.execute.await_count == 1
    assert client.get.call_count == 4


@pytest.mark.asyncio
async def test_token_quota_within_limit(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [
        0,
        0,  # device_used_requests, #30 ip_used_request
        9999,
        19999,  # device tokens, ip tokens
    ]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"
    assert pipe.execute.await_count == 1
    assert client.get.call_count == 4


@pytest.mark.asyncio
async def test_update_token_usage(redis_mock):
    client, pipe = redis_mock
    total_tokens = 20
    pipe.execute.return_value = [total_tokens, True]

    await update_token_usage("127.0.0.1", "aabbgghtyuhjgddddertyuujt", total_tokens)

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    device_key = f"quota:127.0.0.1:aabbgghtyuhjgddddertyuujt:{today_str}"
    ip_key = f"quota:ip:127.0.0.1:{today_str}"

    pipe.incrby.assert_has_calls(
        [call(device_key, total_tokens), call(ip_key, total_tokens)], any_order=True
    )
    pipe.expire.assert_has_calls(
        [call(device_key, 172800), call(ip_key, 172800)], any_order=True
    )

    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_invalid_session_id_contains_colon(redis_mock):
    client, _ = redis_mock
    request = make_request(session_id="session:malicious")

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(request)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid x-session-id format."
    client.pipeline.assert_not_called()


@pytest.mark.asyncio
async def test_invalid_session_id_too_long(redis_mock):
    client, _ = redis_mock
    long_session_id = "a" * 129
    request = make_request(session_id=long_session_id)

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(request)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid x-session-id format."
    client.pipeline.assert_not_called()
