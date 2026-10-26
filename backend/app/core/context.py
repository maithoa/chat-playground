import contextvars
from typing import Optional

client_ip_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "client_ip"
)
session_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "session_id_var"
)

client_device_fp_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "client_device_fp_var"
)
