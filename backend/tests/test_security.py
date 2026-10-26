from unittest.mock import AsyncMock, MagicMock, patch

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

    # Add header extra if exist in params
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

    # Hành vi hiện tại: request.client.host gây AttributeError.
    with pytest.raises(AttributeError):
        await verify_rate_limit_and_quota(request)

    client.pipeline.assert_not_called()


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

    # Redis INCR tạo key chưa tồn tại và trả về 1.
    pipe.execute.return_value = [1, True]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"

    expected_key = "rl:127.0.0.1:aabbgghtyuhjgddddertyuujt:2"
    pipe.incr.assert_called_once_with(expected_key)
    pipe.expire.assert_called_once_with(expected_key, 65)
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_allows_request(redis_mock):
    _, pipe = redis_mock

    # Counter đã tồn tại; sau INCR đạt 10, vẫn được phép.
    pipe.execute.return_value = [10, True]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_exceeds_limit(redis_mock):
    _, pipe = redis_mock

    # Sau INCR đạt 11, vượt giới hạn.
    pipe.execute.return_value = [11, True]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 429
    assert exc.value.detail == "Exceeded limit of 10 requests/min."
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_token_quota_exceeded(redis_mock):
    client, pipe = redis_mock
    pipe.execute.return_value = [1, True]
    client.get = AsyncMock(return_value=5000)

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Exceeded daily token quota" in exc.value.detail
    pipe.execute.assert_awaited_once_with()
    client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_token_quota_within_limit(redis_mock):
    client, pipe = redis_mock
    pipe.execute.return_value = [1, True]
    client.get = AsyncMock(return_value=4999)

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "aabbgghtyuhjgddddertyuujt"
    pipe.execute.assert_awaited_once_with()
    client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_token_usage(redis_mock):
    client, pipe = redis_mock
    total_tokens = 20
    pipe.execute.return_value = [total_tokens, True]

    # Process the function with 20 tokens
    await update_token_usage("127.0.0.1", "aabbgghtyuhjgddddertyuujt", total_tokens)

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    expected_key = f"quota:127.0.0.1:aabbgghtyuhjgddddertyuujt:{today_str}"

    pipe.incrby.assert_called_once_with(expected_key, total_tokens)
    pipe.expire.assert_called_once_with(expected_key, 172800)  # 2 days (86400 * 2)
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_x_forwarded_for_header(redis_mock):
    client, pipe = redis_mock
    request = make_request(
        client=("127.0.0.1", 12345),
        headers_extra={"x-forwarded-for": "203.0.113.195, 70.41.3.18"},
    )

    result = await verify_rate_limit_and_quota(request)

    assert result == "aabbgghtyuhjgddddertyuujt"

    expected_key = "rl:203.0.113.195:aabbgghtyuhjgddddertyuujt:2"
    pipe.incr.assert_called_once_with(expected_key)


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
    # session_id dài quá 128 ký tự
    long_session_id = "a" * 129
    request = make_request(session_id=long_session_id)

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(request)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid x-session-id format."
    client.pipeline.assert_not_called()
