import datetime
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.security import verify_rate_limit_and_quota, update_token_usage

CLIENT_IP = "127.0.0.1"
DEVICE_FP = "aabbgghtyuhjgddddertyuujt"


def make_request(
    *,
    client=(CLIENT_IP, 12345),
    session_id="session-123",
    device_fp=DEVICE_FP,
    headers_extra=None,
):
    headers = []

    if session_id is not None:
        headers.append((b"x-session-id", session_id.encode()))

    if device_fp is not None:
        headers.append((b"x-device-fp", device_fp.encode()))

    for key, value in (headers_extra or {}).items():
        headers.append((key.encode(), value.encode()))

    return Request(
        {
            "type": "http",
            "headers": headers,
            "client": client,
        }
    )


@pytest.fixture(autouse=True)
def mock_settings():
    with patch("app.core.security.settings") as mock_set:
        mock_set.USER_MAX_REQS_PER_MIN = 10
        mock_set.USER_MAX_DAILY_TOKENS = 10000
        yield mock_set


@pytest.fixture
def redis_mock():
    pipe = MagicMock()
    # INCRBY device, EXPIRE device, INCRBY IP, EXPIRE IP
    pipe.execute = AsyncMock(return_value=[1, True, 1, True])
    pipe.__aenter__ = AsyncMock(return_value=pipe)
    pipe.__aexit__ = AsyncMock(return_value=None)

    client = MagicMock()
    client.pipeline.return_value = pipe
    client.get = AsyncMock(return_value=None)

    with (
        patch("app.core.security.redis_client", new=client),
        patch("app.core.security.time.time", return_value=120),
    ):
        yield client, pipe


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "request_kwargs, expected_detail",
    [
        ({"client": None}, "Missing client IP address."),
        ({"device_fp": None}, "Missing x-device-fp in header."),
        ({"session_id": None}, "Missing x-session-id in header."),
        ({"session_id": "session:invalid"}, "Invalid x-session-id format."),
        ({"session_id": "a" * 129}, "Invalid x-session-id format."),
        ({"device_fp": "device:invalid"}, "Invalid x-device-fp format."),
        ({"device_fp": "a" * 129}, "Invalid x-device-fp format."),
    ],
)
async def test_invalid_request_rejected_before_redis(
    redis_mock, request_kwargs, expected_detail
):
    client, _ = redis_mock

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request(**request_kwargs))

    assert exc.value.status_code == 400
    assert exc.value.detail == expected_detail
    client.pipeline.assert_not_called()
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_new_counter_allows_request(redis_mock):
    _, pipe = redis_mock

    result = await verify_rate_limit_and_quota(make_request())

    assert result == DEVICE_FP

    device_key = f"rl:{CLIENT_IP}:{DEVICE_FP}:2"
    ip_key = f"rl:{CLIENT_IP}:2"

    pipe.incrby.assert_has_calls(
        [
            call(device_key, 1),
            call(ip_key, 1),
        ]
    )
    pipe.expire.assert_has_calls(
        [
            call(device_key, 65),
            call(ip_key, 65),
        ]
    )
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_allows_request_at_limits(redis_mock):
    client, pipe = redis_mock
    pipe.execute.return_value = [10, True, 30, True]
    client.get.side_effect = [0, 0]  # Device tokens, IP tokens

    result = await verify_rate_limit_and_quota(make_request())

    assert result == DEVICE_FP
    pipe.execute.assert_awaited_once_with()
    assert client.get.await_count == 2


@pytest.mark.asyncio
async def test_existing_counter_exceeds_device_limit(redis_mock):
    client, pipe = redis_mock
    pipe.execute.return_value = [11, True, 30, True]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 429
    assert exc.value.detail == "Exceeded limit of 10 requests/min."
    pipe.execute.assert_awaited_once_with()
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_new_fingerprint_cannot_bypass_ip_limit(redis_mock):
    client, pipe = redis_mock
    # Fresh device counter, but the shared IP has exceeded its limit.
    pipe.execute.return_value = [1, True, 31, True]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request(device_fp="new-fingerprint"))

    assert exc.value.status_code == 429
    assert exc.value.detail == ("Exceeded limit of max requests/min for an IP address.")
    pipe.incrby.assert_any_call(f"rl:{CLIENT_IP}:2", 1)
    pipe.execute.assert_awaited_once_with()
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_forwarded_header_does_not_override_client_ip(redis_mock):
    client, pipe = redis_mock

    result = await verify_rate_limit_and_quota(
        make_request(headers_extra={"x-forwarded-for": "203.0.113.195"})
    )

    assert result == DEVICE_FP
    assert pipe.incrby.call_args_list == [
        call(f"rl:{CLIENT_IP}:{DEVICE_FP}:2", 1),
        call(f"rl:{CLIENT_IP}:2", 1),
    ]

    today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    assert client.get.await_args_list == [
        call(f"quota:{CLIENT_IP}:{DEVICE_FP}:{today}"),
        call(f"quota:ip:{CLIENT_IP}:{today}"),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "device_tokens, ip_tokens, expected_detail",
    [
        (10000, 0, "Exceeded daily token quota (10000/10000 tokens)."),
        (
            0,
            20000,
            "Exceeded daily token quota for IP address " "(20000/20000 tokens).",
        ),
    ],
)
async def test_token_quota_exceeded(
    redis_mock, device_tokens, ip_tokens, expected_detail
):
    client, pipe = redis_mock
    client.get.side_effect = [device_tokens, ip_tokens]

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 429
    assert exc.value.detail == expected_detail
    pipe.execute.assert_awaited_once_with()
    assert client.get.await_count == 2


@pytest.mark.asyncio
async def test_token_quota_within_limit(redis_mock):
    client, pipe = redis_mock
    client.get.side_effect = [9999, 19999]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == DEVICE_FP
    pipe.execute.assert_awaited_once_with()
    assert client.get.await_count == 2


@pytest.mark.asyncio
async def test_rate_limit_redis_failure_rejects_request(redis_mock):
    client, pipe = redis_mock
    pipe.execute.side_effect = ConnectionError("Redis unavailable")

    with pytest.raises(HTTPException) as exc:
        await verify_rate_limit_and_quota(make_request())

    assert exc.value.status_code == 503
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_token_usage(redis_mock):
    _, pipe = redis_mock
    total_tokens = 20

    await update_token_usage(CLIENT_IP, DEVICE_FP, total_tokens)

    today = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    device_key = f"quota:{CLIENT_IP}:{DEVICE_FP}:{today}"
    ip_key = f"quota:ip:{CLIENT_IP}:{today}"

    pipe.incrby.assert_has_calls(
        [
            call(device_key, total_tokens),
            call(ip_key, total_tokens),
        ]
    )
    pipe.expire.assert_has_calls(
        [
            call(device_key, 172800),
            call(ip_key, 172800),
        ]
    )
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
@pytest.mark.parametrize("total_tokens", [-1, 1.5, "20", None])
async def test_invalid_token_usage_does_not_update_redis(redis_mock, total_tokens):
    client, _ = redis_mock

    with pytest.raises(ValueError):
        await update_token_usage(CLIENT_IP, DEVICE_FP, total_tokens)

    client.pipeline.assert_not_called()
