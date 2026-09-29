from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any


class BaseLLMHandler(ABC):
    @abstractmethod
    async def stream_chat(
        self, model: str, messages: List[Dict[str, str]], **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """All providers should return an AsyncGenerator to stream the data return by LLM models."""
        pass
