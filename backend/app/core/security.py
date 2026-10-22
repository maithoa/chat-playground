import time
import datetime
from fastapi import APIRouter, FastAPI, Request, HTTPException, status, Depends
from app.schemas.llm import ChatRequest
import redis.asyncio as redis

from loguru import logger

# Init Redis connection
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


async def verify_rate_limit_and_quota(request: Request):
    # Get the client IP and session id
    client_ip = request.client.host
    forward_for = request.headers.get("x-forwarded-for")
    if forward_for:
        client_ip = forward_for.split(",")[0].strip()

    session_id = request.headers.get("x-session-id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing x-session-id in header.",
        )
    logger.info(f"Session id: {session_id}")

    await _check_rate_limit(client_ip=client_ip, session_id=session_id)
    await _check_token_quota(client_ip=client_ip, session_id=session_id)

    return session_id


async def _check_rate_limit(client_ip: str, session_id: str):
    """
    Return True if within rate limit (10 requests/min.) , otherwise False

    Args:
        client_ip: Client side IP address
        session_id: Sessions from Client
    """
    window_seconds = 60
    max_hourly_requests = 10
    current_time = int(time.time())
    current_window = current_time // window_seconds
    rate_limit_key = f"rl:{client_ip}:{session_id}:{current_window}"

    try:
        async with redis_client.pipeline() as pipe:
            pipe.incr(rate_limit_key)
            pipe.expire(rate_limit_key, window_seconds + 5)
            results = await pipe.execute()
    except Exception as ex:
        logger.error(f"Redis error in rate limit checking: {ex}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

    if results[0] > max_hourly_requests:
        logger.info("Exceeded limit of max requests per min.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded limit of {max_hourly_requests} requests/min.",
        )


async def _check_token_quota(client_ip: str, session_id: str):
    """
    Return True if within usage limit  per day (eg 5000 total token used/day.) , otherwise False

    Args:
        client_ip: Client side IP address
        session_id: Sessions from Client
    """
    max_daily_tokens = 5000
    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{session_id}:{today_str}"

    # Get total token used per day
    current_tokens = await redis_client.get(quota_key)
    total_used = int(current_tokens) if current_tokens else 0

    if total_used >= max_daily_tokens:
        logger.info("Exceeded limit of max token used per day.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded daily token quota ({total_used}/{max_daily_tokens} tokens).",
        )
