Project Plan
📦 1️⃣ Code set‑up (Category tag: code-setup)
#	Task	Linked Epic / User Story
1	Create FastAPI skeleton (app/main.py, routers, models)	Epic 1 – User Authentication & Session Management – Story 3
2	Add SQLite database with SQLModel models for users, sessions, metrics	Epic 1 – User Authentication & Session Management – Story 4
3	Implement OAuth endpoints for Google & GitHub (login, callback, JWT issuance)	Epic 1 – User Authentication & Session Management – Stories 1‑2
4	Add public test endpoint allowing unauthenticated users to query free LLMs	Epic 2 – Multi‑LLM Selection & Interaction – Story 2 (but open to all)
5	Create metrics endpoint (/stats) returning aggregated usage data	Epic 3 – Public Dashboard & Analytics – Stories 1‑4
6	Add rate‑limiting per user (max requests per day) in FastAPI middleware	Epic 2 – Multi‑LLM Selection & Interaction – Story 2 (protect free usage)
7	Add structured logging (structlog) and Sentry integration	Cross‑cutting – applies to all back‑end work
🏗️ 2️⃣ Infra set‑up (Category tag: infra-setup)
#	Task	Linked Epic / User Story
1	Dockerize backend (write Dockerfile.backend)	Cross‑cutting – needed for deployment
2	Dockerize frontend (write Dockerfile.frontend)	Cross‑cutting – needed for deployment
3	Prepare Fly.io configuration (app name, secrets, region)	Cross‑cutting – deployment target
⚙️ 3️⃣ CI / CD pipeline set‑up (Category tag: ci-cd)
#	Task	Linked Epic / User Story
1	Write GitHub Actions workflow (install, test, build Docker images, deploy to Fly.io)	Cross‑cutting – automates everything
2	Add steps to run the create_issues.sh script and verify issues land in the Backlog column	Epic 4 – Team Workflow Automation – Story 1
🔧 4️⃣ Backend (Category tag: backend)
#	Task	Linked Epic / User Story
1	Implement FastAPI routes for LLM calls (including token & latency tracking)	Epic 2 – Multi‑LLM Selection & Interaction – Stories 3‑5
2	Integrate SQLite models with the API (CRUD for users, sessions, metrics)	Epic 1 – User Authentication & Session Management – Story 3
3	Add middleware for rate‑limiting & structured logging	Epic 2 – Multi‑LLM Selection & Interaction – Story 2
4	Write unit / integration tests (use tdd skill if you prefer)	Cross‑cutting – ensures reliability
🎨 5️⃣ Front‑end (Category tag: frontend)
#	Task	Linked Epic / User Story
1	Initialise Vite + React project (frontend/)	Cross‑cutting – foundation
2	Implement login UI (Google / GitHub buttons, JWT handling)	Epic 1 – User Authentication & Session Management – Stories 1‑2
3	Build chat UI (message list, input box, streaming response)	Epic 2 – Multi‑LLM Selection & Interaction – Stories 2‑4
4	Add model selector component & token/latency display	Epic 2 – Multi‑LLM Selection & Interaction – Stories 1‑5
5	Create public dashboard page showing aggregated stats from /stats	Epic 3 – Public Dashboard & Analytics – Stories 1‑4
6	Wire front‑end to FastAPI endpoints (fetch calls, error handling)	All backend tasks above
7	Add front‑end tests (Jest / React Testing Library)	Cross‑cutting – quality gate
🚀 6️⃣ Deploy (Category tag: deploy)
#	Task	Linked Epic / User Story
1	Deploy backend Docker image to Fly.io	Cross‑cutting – final delivery
2	Deploy frontend Docker image to Fly.io (or serve via CDN)	Cross‑cutting
3	Verify environment variables & secrets are correctly set on Fly.io	Cross‑cutting
4	Smoke‑test the live app (login, chat, dashboard)	All user‑stories – confirm end‑to‑end flow
📚 7️⃣ Documentation (Category tag: docs)
#	Task	Linked Epic / User Story
1	Write README with project overview, setup, and run instructions	Cross‑cutting
2	Add CONTRIBUTING guide (how to contribute, issue/PR process)	Cross‑cutting
3	Create .env.example listing required environment variables	Cross‑cutting
4	Document ADRs and domain model in adr (already started)	Cross‑cutting
5	Generate API docs for FastAPI (e.g., via fastapi.openapi)	Cross‑cutting
