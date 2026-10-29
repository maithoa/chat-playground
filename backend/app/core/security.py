import time
import datetime
from fastapi import Request, HTTPException, status, Depends
import redis.asyncio as redis
import asyncio

from loguru import logger

from app.core.context import client_ip_var, session_id_var, client_device_fp_var
from app.core.config import settings

# Init Redis connection
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


async def verify_rate_limit_and_quota(request: Request):
    # Get the client IP and session id
    client_ip = getattr(request.client, "host", None)
    if not client_ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing client IP address.",
        )

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
    await increase_requests_pm_count(client_ip, device_fp)

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
    max_reqs_pm = settings.USER_MAX_REQS_PER_MIN
    current_time = int(time.time())
    current_window = current_time // window_seconds
    rate_limit_key = f"rl:{client_ip}:{device_fp}:{current_window}"
    rate_limit_per_ip = f"rl:{client_ip}:{current_window}"
    hourly_requests = 0

    try:
        device_requests_res, ip_requests_res = await asyncio.gather(
            redis_client.get(rate_limit_key), redis_client.get(rate_limit_per_ip)
        )

        hourly_requests = int(device_requests_res) if device_requests_res else 0
        ip_requests = int(ip_requests_res) if ip_requests_res else 0

    except Exception as ex:
        logger.error(f"Redis error in rate limit checking: {ex}")
        raise HTTPException(status_code=500, detail="Internal Server Error.")

    if hourly_requests > max_reqs_pm:
        logger.info("Exceeded limit of max requests per min.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded limit of {max_reqs_pm} requests/min.",
        )
    #
    if ip_requests > max_reqs_pm * 3:
        logger.info("Exceeded limit of max requests per min per IP address.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded limit of max requests/min for an IP address.",
        )

    return int(hourly_requests)


async def _check_token_quota(client_ip: str, device_fp: str):
    """
    Return True if within usage limit  per day (eg 5000 total token used/day.) , otherwise False

    Args:
        client_ip: Client side IP address
        session_id: Sessions from Client
    """
    max_daily_tokens = settings.USER_MAX_DAILY_TOKENS
    max_ip_tokens = max_daily_tokens * 2

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{device_fp}:{today_str}"
    ip_key = f"quota:ip:{client_ip}:{today_str}"

    # Get total token used per day
    device_tokens_res, ip_tokens_res = await asyncio.gather(
        redis_client.get(quota_key), redis_client.get(ip_key)
    )

    total_used = int(device_tokens_res) if device_tokens_res else 0

    if total_used >= max_daily_tokens:
        logger.info("Exceeded limit of max token used per day.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded daily token quota ({total_used}/{max_daily_tokens} tokens).",
        )

    # One more round check for ip address
    current_ip_tokens_used = int(ip_tokens_res) if ip_tokens_res else 0

    if current_ip_tokens_used >= max_ip_tokens:
        logger.info("Exceeded limit of max token used per day for this IP address.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Exceeded daily token quota for IP address ({current_ip_tokens_used}/{max_ip_tokens} tokens).",
        )

    return total_used


async def increase_requests_pm_count(client_ip: str, device_fp: str):
    """This method is called after each called is done to api/v1/llm endpoint"""

    window_seconds = 60

    current_time = int(time.time())
    current_window = current_time // window_seconds
    rate_limit_key = f"rl:{client_ip}:{device_fp}:{current_window}"
    rate_limit_per_ip = f"rl:{client_ip}:{current_window}"

    async with redis_client.pipeline() as pipe:
        pipe.incrby(rate_limit_key, 1)
        pipe.expire(rate_limit_key, 86400 * 2)  # Keep the key/value for 2 days

        pipe.incrby(rate_limit_per_ip, 1)
        pipe.expire(rate_limit_per_ip, 86400 * 2)  # Keep the key/value for 2 days

        await pipe.execute()


async def update_token_usage(client_ip: str, device_fp: str, total_tokens: int):
    """This method is called after LLM return the usage tokens."""

    if not isinstance(total_tokens, int) or total_tokens < 0:
        logger.error(f"Invalid token count received: {total_tokens}")
        raise ValueError("total_tokens must be a non-negative integer.")

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{device_fp}:{today_str}"
    ip_key = f"quota:ip:{client_ip}:{today_str}"

    async with redis_client.pipeline() as pipe:
        pipe.incrby(quota_key, total_tokens)
        pipe.expire(quota_key, 86400 * 2)  # Keep the key/value for 2 days

        pipe.incrby(ip_key, total_tokens)
        pipe.expire(ip_key, 86400 * 2)  # Keep the key/value for 2 days

        await pipe.execute()


async def get_user_usage_data():
    """Service method to fetch usage data without incrementing counters."""
    client_ip = client_ip_var.get()
    device_fp = client_device_fp_var.get()

    if not client_ip or not device_fp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing context data.",
        )

    today_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    quota_key = f"quota:{client_ip}:{device_fp}:{today_str}"
    device_token_res = await redis_client.get(quota_key)

    # Get total token used per day
    token_used = int(device_token_res) if device_token_res else 0

    # Get hourly requests sent
    window_seconds = 60
    max_reqs_pm = settings.USER_MAX_REQS_PER_MIN
    current_time = int(time.time())
    current_window = current_time // window_seconds
    rate_limit_key = f"rl:{client_ip}:{device_fp}:{current_window}"
    hourly_requests_res = await redis_client.get(rate_limit_key)

    hourly_requests = int(hourly_requests_res) if hourly_requests_res else 0

    user_usage = {
        "device_fp": device_fp,
        "tokens_used": token_used,
        "requests_used": hourly_requests,
        "max_daily_tokens": settings.USER_MAX_DAILY_TOKENS,
        "max_hourly_requests": settings.USER_MAX_REQS_PER_MIN,
    }
    logger.info("user_usage", user_usage)
    return user_usage


async def extract_client_context(request: Request):

    client_ip = getattr(request.client, "host", None)
    if not client_ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing client IP address.",
        )

    device_fp = request.headers.get("x-device-fp")
    if not device_fp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing x-device-fp in header.",
        )

    client_ip_var.set(client_ip)
    client_device_fp_var.set(device_fp)
    return device_fp
