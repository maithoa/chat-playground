---
name: Chat Playground MVP Specification
about: Comprehensive spec for the chat playground project, derived from EPICS and issue templates.
labels: ready-for-agent
---

## Problem Statement

The user needs a minimal viable product (MVP) that allows internet users to authenticate via Google or GitHub, interact with multiple free large language models (LLMs) in a chat interface, and view aggregated usage analytics. The current repository contains high‑level epics and user stories but lacks concrete, actionable details needed for issue creation and implementation planning.

## Solution

Provide a detailed specification that expands the existing epics into concrete user stories, defines implementation and testing decisions, and aligns with the project's issue templates (`epic.md`, `user_story.md`, `task.md`). This spec will serve as the source for creating GitHub issues and tasks, enabling the team to start development immediately.

## User Stories

1. **As a Visitor**, I want to see a public dashboard showing total registered users, daily active users, total questions asked, and LLM usage breakdown, so that I can gauge the platform’s activity.
2. **As a Visitor**, I want to view a list of available free LLMs (e.g., OpenAI gpt‑3.5‑turbo, Anthropic claude‑2, HuggingFace distilbert) before signing in, so that I know my options.
3. **As a User**, I want to click a "Sign in with Google" button and be redirected to Google OAuth, then return logged in, so that I can securely access my account.
4. **As a User**, I want to click a "Sign in with GitHub" button and be redirected to GitHub OAuth, then return logged in, so that I can securely access my account.
5. **As a User**, after signing in I want to see my username displayed and start a new chat session, so that I know I am authenticated.
6. **As a User**, I want my authentication state to persist across page reloads, so that I do not need to log in repeatedly.
7. **As a User**, I want to select an LLM from a dropdown before sending a question, so that I can choose the model I prefer.
8. **As a User**, I want to type a question and submit it, receiving a streamed answer, token usage count, and latency, so that I can interact with the model efficiently.
9. **As a User**, I want the system to enforce a daily request limit (e.g., 100 requests) via rate‑limiting middleware, so that free usage is fair.
10. **As a User**, I want errors (e.g., rate limit exceeded, model unavailable) displayed clearly, so that I understand why a request failed.
11. **As a Developer**, I want structured logs (JSON) for each request, including user ID, model, token count, latency, and errors, so that we can monitor and debug the service.
12. **As a DevOps Engineer**, I want the backend and frontend Docker images built and deployed to Fly.io automatically via GitHub Actions, so that releases are reproducible.
13. **As a DevOps Engineer**, I want environment variables (e.g., OAuth client secrets, Fly.io tokens) stored securely as secrets, so that credentials are not exposed.
14. **As a QA Engineer**, I want unit and integration tests for authentication, LLM routing, rate limiting, and metrics endpoints, so that the codebase maintains high quality.
15. **As a Project Lead**, I want the `create_issues.sh` script to read this SPEC.md and generate GitHub issues for each epic, user story, and task, linking them appropriately, so that the backlog is populated automatically.

*(The list can be extended further; these cover all major functional areas.)*

## Implementation Decisions

- **Backend Framework**: FastAPI will host the API, using SQLModel for SQLite persistence.
- **Authentication**: OAuth2 flows for Google and GitHub, issuing JWTs stored in HttpOnly cookies.
- **LLM Integration**: Abstract LLM client interface with concrete adapters for OpenAI, Anthropic, and HuggingFace APIs.
- **Rate Limiting**: Middleware using a simple in‑memory counter per user ID, configurable via environment variable.
- **Metrics**: `/stats` endpoint aggregates user count, daily active users, total queries, and per‑model usage; data stored in SQLite tables.
- **Logging**: `structlog` configured for JSON output; Sentry integration optional via DSN env var.
- **Docker**: Separate Dockerfiles for backend (`Dockerfile.backend`) and frontend (`Dockerfile.frontend`). Multi‑stage builds to keep images small.
- **CI/CD**: GitHub Actions workflow builds Docker images, runs tests, and deploys to Fly.io on push to `main`.
- **Issue Generation**: `create_issues.sh` will parse this SPEC.md, creating Epic issues (using `epic.md` template), User Story issues (using `user_story.md`), and Task issues (using `task.md`). Labels: `epic`, `user-story`, `task`, plus component tags (`frontend`, `backend`, `infra`).
- **Seam for Testing**: The highest‑level seam is the FastAPI application object (`app`). Tests will interact with the API via HTTP client without needing to mock internal functions.

## Testing Decisions

- **Test Scope**: Focus on external behavior (HTTP responses, status codes, JSON payloads). Avoid testing internal implementation details.
- **Modules Tested**: Authentication routes, LLM routing endpoint, rate‑limiting middleware, `/stats` endpoint, Docker build steps (via `docker build` in CI), and the `create_issues.sh` script.
- **Prior Art**: Existing FastAPI test examples in the repo (see `tests/` folder) will be extended.
- **Tools**: `pytest` with `httpx` for async HTTP calls; `pytest-cov` for coverage; `tox` for environment isolation.

## Out of Scope

- Implementing paid LLM integrations or billing.
- Real‑time WebSocket chat (the MVP uses simple HTTP polling/streaming).
- Advanced analytics beyond the basic counts listed.
- Multi‑tenant deployment or per‑organization isolation.
- Mobile app implementation.

## Further Notes

- The spec should be kept in sync with `PROJECT_PLAN.md`; any changes to priorities must be reflected here.
- After creating this SPEC.md, run `./scripts/create_issues.sh <repo>` to populate the GitHub project board.
- Ensure the `ready-for-agent` label is applied to the created GitHub issue so that downstream automation can pick it up.
