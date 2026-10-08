# AI AGENT EXECUTION CONSTRAINTS: Dual-Model Real-Time Arena

> **CRITICAL INSTRUCTION FOR AGENT:** You are acting as an autonomous execution engine. Read this entire specification before generating or modifying code. You MUST strictly adhere to the defined file boundaries, type contracts, algorithmic constraints, and verification criteria. Do NOT alter shared core modules or introduce unapproved dependencies.

---

## 1. Execution Scope & File Boundaries

### BACKEND
- **Allowed Scope  (Can CREATE and MODIFY only within these paths):**
  - `backend/app/services/llm/**` (Clould Provider Handlers and LLM Service)
  - `backend/app/tests/**` (Unit test files)
  - `backend/api/v1/endpoints/llm.py` (API Controllers)
  - `backend/api/v1/router.py` (Router configurations)

- **Forbidden Scope (STRICTLY READ-ONLY or DO NOT TOUCH):**
  - `frontend/**`
  - `backend/app/core/**`
  - `backend/app/models/**`
  - Root project configurations (`pyproject.toml`)
---

## 2. SSE Output Event Protocol (`backend/app/services/llm/**)

All handlers (`GroqHandler`, `GoogleHandler`, `OpenRouterHandler`) MUST implement `stream_chat` yielding raw string chunks, and execute `on_usage_complete` in a `finally:` block with a strictly typed dictionary.

### Handler Stream Signature
```python
async def stream_chat(
    self,
    model: str,
    messages: List[Dict[str, str]],
    on_usage_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
    **kwargs: Any
) -> AsyncGenerator[str, None]:
```
usage_data Dictionary Contract (Passed to on_usage_complete)

The usage_data payload MUST contain exact keys and units below:

```python
{
    "prompt_tokens": int,
    "completion_tokens": int,
    "total_tokens": int,
    "time_to_first_token_ms": float,  # Rounded to 2 decimal places
    "tokens_per_second": float        # Rounded to 2 decimal places
}
```
### 3. Algorithmic Constraints for Provider Handlers

All provider handlers (google_handler.py, groq_handler.py, openrouter_handler.py) MUST implement high-precision timing logic using time.perf_counter():

  - Timestamping Protocol:

        Record start_time = time.perf_counter() immediately before sending the API request to the provider.

        Record first_token_time when the first non-empty text chunk is received from the provider stream.

        Calculate timeToFirstTokenMs = (first_token_time - start_time) * 1000.

  - Metrics Calculation:
        ```Python
                total_duration_ms = (end_time - start_time) * 1000

                tokens_per_second = completion_tokens / (total_duration_ms / 1000) //(If provider doesn't return completion_tokens, calculate via fallback token counter or chunk count).
        ```
  - Error Normalization:

        Metrics calculation and execution of on_usage_complete MUST be encapsulated inside a finally: block to ensure metrics are reported even if the stream is aborted mid-way by the user.

## 4. Definition of Done
Before marking execution complete, the Agent MUST run and pass:

1. cd backend && pytest -vv tests/services/llm/ (All unit tests pass with mocked SDKs)

2. cd backend && python -m app.main (Completes with 0 syntax or import errors)
