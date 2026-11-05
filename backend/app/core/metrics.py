from prometheus_client import Counter, Gauge

CHAT_REQUESTS = Counter(
    "chat_generation_requests_total",
    "Chat generation requests admitted after quota and model validation",
    ["provider", "model"],
)

CHAT_ACTIVE_STREAMS = Gauge(
    "chat_active_streams",
    "Number of active chat streams",
)
