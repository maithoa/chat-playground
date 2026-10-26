import time
import datetime
from fastapi import Request, HTTPException, status, Depends
import redis.asyncio as redis

from loguru import logger

from app.core.context import client_ip_var, session_id_var, client_device_fp_var

# Init Redis connection
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


async def verify_rate_limit_and_quota(request: Request):
    # Get the client IP and session id
    client_ip = getattr(request.client, "host", None)
    if not client_ip:
        raise AttributeError("Missing client ip")

    forward_for = request.headers.get("x-forwarded-for")
    if forward_for:
        client_ip = forward_for.split(",")[0].strip()

    session_id = request.headers.get("x-session-id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing x-session-id in header.",
        )

    if ":" in session_id or len(session_id) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid x-session-id format.",
        )

    device_fp = request.headers.get("x-device-fp")
    if not device_fp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing x-device-fp in header.",
        )

    if ":" in device_fp or len(device_fp) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid x-device-fp format.",
        )

    # Set value to context for later use in Service layer.
    client_ip_var.set(client_ip)
    session_id_var.set(session_id)
    client_device_fp_var.set(device_fp)

    logger.info(
        f"Session id: {session_id}, IP: {client_ip}, Device fingerprint: {device_fp}"
    )

    await _check_rate_limit(client_ip=client_ip, device_fp=device_fp)
    await _check_token_quota(client_ip=client_ip, device_fp=device_fp)

    return device_fp


async def _check_rate_limit(client_ip: str, device_fp: str):
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
    rate_limit_key = f"rl:{client_ip}:{device_fp}:{current_window}"

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


async def _check_token_quota(client_ip: str, device_fp: str):
    """
    Return True if within usage limit  per day (eg 5000 total token used/day.) , otherwise False

    Args:
        client_ip: Client side IP address
        session_id: Sessions from Client
    """
    max_daily_tokens = 5000
    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{device_fp}:{today_str}"

    # Get total token used per day
    current_tokens = await redis_client.get(quota_key)
    total_used = int(current_tokens) if current_tokens else 0

    if total_used >= max_daily_tokens:
        logger.info("Exceeded limit of max token used per day.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded daily token quota ({total_used}/{max_daily_tokens} tokens).",
        )


async def update_token_usage(client_ip: str, device_fp: str, total_tokens: int):
    """This method is called after LLM return the usage tokens."""

    if not isinstance(total_tokens, int) or total_tokens < 0:
        logger.error(f"Invalid token count received: {total_tokens}")
        raise ValueError("total_tokens must be a non-negative integer.")

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{device_fp}:{today_str}"

    async with redis_client.pipeline() as pipe:
        pipe.incrby(quota_key, total_tokens)
        pipe.expire(quota_key, 86400 * 2)  # Keep the key/value for 2 days
        await pipe.execute()
