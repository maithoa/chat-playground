import asyncio
from app.services.llm.openai_handler import OpenAIHandler
from app.services.llm.groq_handler import GroqHandler


async def main():
    # handler = OpenAIHandler()
    handler = GroqHandler()

    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Count from 1 to 5 in Vietnamese."},
    ]

    print("---Streaming starts---")

    try:
        async for chunk in handler.stream_chat(
            model="openai/gpt-oss-120b", messages=messages
        ):
            print(chunk, end="", flush=True)
        print("\n---Streaming ends---")
    except Exception as ex:
        print(f"\nError: {ex.with_traceback}")


if __name__ == "__main__":
    asyncio.run(main())
