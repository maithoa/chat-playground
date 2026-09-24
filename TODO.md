# Project Work Structure

## 1️⃣ Code set‑up
- Create FastAPI skeleton (`app/main.py`, routers, models)
- Add SQLite database with SQLModel models for users, sessions, metrics
- Implement OAuth endpoints for Google and GitHub (login, callback, JWT issuance)
- Add public test endpoint allowing unauthenticated users to query free LLMs
- Create metrics endpoint (`/stats`) returning aggregated usage data
- Add rate‑limiting per user (max requests per day) in FastAPI middleware
- Add structured logging (`structlog`) and Sentry integration

## 2️⃣ Infra set‑up
- Dockerize backend and frontend, write Dockerfiles
- Prepare Fly.io configuration (app name, secrets, region)

## 3️⃣ CI / CD pipeline set‑up
- Write GitHub Actions workflow (install, test, build Docker images, deploy to Fly.io)

## 4️⃣ Backend
- Implement the FastAPI routes and business logic (LLM calls, token/latency tracking)
- Integrate SQLite models with the API
- Add rate‑limiting and logging middleware

## 5️⃣ Front‑end
- Initialise Vite + React project (`frontend/` folder)
- Implement login UI (Google/GitHub buttons, JWT handling)
- Build chat UI (message list, input box, streaming response display)
- Add model selector and token/latency display components
- Create public dashboard page showing aggregated stats from `/stats`
- Wire the front‑end to the FastAPI endpoints (fetch calls, error handling)

## 6️⃣ Deploy
- Deploy Docker images to Fly.io (backend & front‑end)
- Verify environment variables and secrets are set correctly
- Test the live app (login, chat, dashboard)

## 7️⃣ Documentation
- Write README with project overview, setup, and run instructions
- Add CONTRIBUTING guide (how to contribute, issue/PR process)
- Create `.env.example` with required environment variables
- Document the ADRs and domain model in `docs/adr/`
