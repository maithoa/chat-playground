import time
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

    window_seconds = 60
    max_requests = 10
    current_time = int(time.time())
    current_window = current_time // window_seconds
    rate_limit_key = f"rl:{client_ip}:{session_id}:{current_window}"

    results = None

    try:
        pipeline = redis_client.pipeline()
        pipeline.incr(rate_limit_key)
        pipeline.expire(rate_limit_key, window_seconds + 5)

        results = await pipeline.execute()

    except Exception as ex:
        logger.error(f"Exeption while handing with Redis.{ex}")
        raise

    if results[0] > max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded limit of {max_requests} requests/min.",
        )

    return session_id
