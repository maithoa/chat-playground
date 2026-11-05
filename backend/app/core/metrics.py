from prometheus_client import Counter, Gauge, Histogram

CHAT_REQUESTS = Counter(
    "chat_generation_requests_total",
    "Chat generation requests admitted after quota and model validation",
    ["provider", "model"],
)

CHAT_ACTIVE_STREAMS = Gauge(
    "chat_active_streams",
    "Number of active chat streams",
)

CHAT_STREAM_DURATION = Histogram(
    "chat_stream_duration_seconds",
    "Duration of chat stream processing in seconds",
    buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300),
)
