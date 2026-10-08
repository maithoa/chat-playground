import sys
from loguru import logger
from app.core.config import settings


def init_logger():
    logger.remove()

    # Logging to file if LOG_FILE_PATH is set in .env
    if settings.LOG_FILE_PATH:
        logger.add(
            settings.LOG_FILE_PATH,
            rotation="10 MB",  # Rotate after 10 MB
            retention="10 days",  # Keep logs for 10 days
            level=settings.LOG_LEVEL or "INFO",
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            enqueue=True,  # Use a queue to handle logging in multi-threaded environments
            backtrace=True,  # Enable backtrace for better error context
            diagnose=True,  # Show variable values
            encoding="utf-8",  # Ensure logs are written in UTF-8
        )
    else:
        # Logging to stdout if LOG_FILE_PATH is not set
        logger.add(
            sys.stdout,
            level=settings.LOG_LEVEL or "INFO",
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            enqueue=True,  # Use a queue to handle logging in multi-threaded environments
            backtrace=True,  # Enable backtrace for better error context
            diagnose=True,  # Show variable values
            encoding="utf-8",  # Ensure logs are written in UTF-8
        )
