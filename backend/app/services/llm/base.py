from abc import ABC, abstractmethod
from typing import AsyncGenerator, Callable, List, Dict, Any, Optional


class BaseLLMHandler(ABC):
    @abstractmethod
    async def stream_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        on_usage_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """All providers should return an AsyncGenerator to stream the data return by LLM models."""
        pass
