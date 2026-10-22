from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.security import verify_rate_limit_and_quota


def make_request(*, client=("127.0.0.1", 12345), session_id="session-123"):
    headers = []
    if session_id is not None:
        headers.append((b"x-session-id", session_id.encode()))

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

    assert result == "session-123"

    expected_key = "rl:127.0.0.1:session-123:2"
    pipe.incr.assert_called_once_with(expected_key)
    pipe.expire.assert_called_once_with(expected_key, 65)
    pipe.execute.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_existing_counter_allows_request(redis_mock):
    _, pipe = redis_mock

    # Counter đã tồn tại; sau INCR đạt 10, vẫn được phép.
    pipe.execute.return_value = [10, True]

    result = await verify_rate_limit_and_quota(make_request())

    assert result == "session-123"
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
