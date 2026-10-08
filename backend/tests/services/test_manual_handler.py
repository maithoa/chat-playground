import asyncio
from app.services.llm.groq_handler import GroqHandler
from app.services.llm.openrouter_handler import OpenRouterHandler
from app.services.llm.google_handler import GoogleHandler


async def handle_usage(usage_dict):
    print(f"\nHandle usage called : {usage_dict}")


async def main():
    # handler = OpenAIHandler()
    handler = GroqHandler()
    # handler = OpenRouterHandler()
    # handler = GoogleHandler()
    # model = "gpt-4o"
    model = "openai/gpt-oss-120b"
    # model = "nvidia/nemotron-3-ultra-550b-a55b:free"
    # model = "nvidia/nemotron-3.5-lightning:free"
    # model = "stealth/space-bunny-alpha"
    # model = "gemini-3.5-flash-lite"
    # model = "gemini-3.1-pro-preview"
    # model = "openrouter/free"

    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Count from 1 to 5 in Vietnamese."},
    ]

    print("---Streaming starts---")

    try:
        async for chunk in handler.stream_chat(
            model=model,
            messages=messages,
            on_usage_complete=handle_usage,
        ):
            print(chunk, end="", flush=True)
        print("\n---Streaming ends---")
    except Exception as ex:
        print(f"\nError: {ex}")


if __name__ == "__main__":
    asyncio.run(main())

"""
curl -N -X POST "http://localhost:8686/api/v1/llm/chat"
-H "Content-Type: application/json"
-d '{'
    '"provider":"openrouter", '
    '"model":"openai/gpt-oss-120b", '
    '"messages": ['
    '{"role": "system", "content":"You are an AI assistant who talks short and precise."}, '
    '{"role":"user", "content":"What is the shape of the earth?"}'
    '],'
'}'

"""
