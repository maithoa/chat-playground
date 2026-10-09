import json
import inspect
from typing import List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.schemas.llm import ProviderInfo, ChatRequest
from app.services.llm.service import LLMService
from app.schemas.llm import StreamEventType, StreamEvent

router = APIRouter(prefix="/llm", tags=["LLM Catalog"])


@router.get("/providers", response_model=List[ProviderInfo])
async def list_providers():
    """Return a list of LLM Cloud Providers and their models for Guest Mode"""
    return LLMService.get_llm_providers()


@router.post("/chat")
async def chat_stream(request: ChatRequest):
    """
    Return response for client chat message and stream it back.

    Args:
        request: include provider name, model name and messages.

    Raises:
        HTTPException: In case LLM Provider is not supported.
        HTTPException: In case model is not supported.

    Returns:
        Stream of chunk of llm's response.

    Yields:
        chunk of llm's response.
    """
    # Validate if LLM Provider info is accurate and supported by the app
    llm_providers = LLMService.get_llm_providers()

    input_provider = request.provider
    provider_info = next((p for p in llm_providers if p.id == input_provider), None)

    if not provider_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{input_provider}' is not supported or initiated.",
        )

    # Validate if model is belonging to the selected provider
    input_model = request.model
    model_info = next((m for m in provider_info.models if m.id == input_model), None)

    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{input_model}' is not supported by the selected Cloud Provider '{provider_info.id}' ",
        )

    # Stream generator
    async def event_generator():
        try:
            stream = LLMService.stream_chat(
                provider=provider_info.id,
                model=model_info.id,
                messages=request.messages,
                temperature=request.temperature,
            )
            if inspect.iscoroutine(stream):
                stream = await stream

            async for streamEvent in stream:
                yield streamEvent.to_sse_data()

        except Exception as e:
            error_event = StreamEvent(type=StreamEventType.ERROR, data=str(e))
            yield error_event.to_sse_data()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


"""
Test usage
curl -N -X POST "http://localhost:8000/api/v1/llm/chat"   -H "Content-Type: application/json"   -d '{
    "provider": "openrouter",
    "model": "openrouter/free",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant with short, accurate communicate style"},
      {"role": "user", "content": "What is the shape of the globe?"}
    ]
  }'
"""
