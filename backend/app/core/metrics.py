from prometheus_client import Counter

CHAT_REQUESTS = Counter(
    "chat_generation_requests_total",
    "Chat generation requests admitted after quota and model validation",
    ["provider", "model"],
)
