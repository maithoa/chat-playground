# ⚡ LLM Chat Playground

A personal full-stack playground built to refresh and sharpen hands-on skills in **React**, **TypeScript**, and **Python (FastAPI)**, while building a clean, complete, and functional app just for fun.

This app backend connects to a local Redis Docker instance.

It features a Tailwind CSS homepage-inspired dark interface that connects to multiple cloud LLM providers (Groq, Google Gemini, OpenRouter), supports dual-model side-by-side stream comparison, and implements real-time usage tracking with Redis.

## 🌟 Key Features

* **Single Chat Mode**: Direct streaming chat with selected models across providers (Groq, Google Gemini, OpenRouter).
* **Duo Arena Mode**: Benchmark two models side-by-side with identical prompts to compare response speed, output streaming quality, and token counts.
* **Usage & Rate Limiting**: Backend tracks daily token allowances and rate limits per client IP/device using a local Redis instance.
* **Tailwind-Inspired Dark UI**: Responsive, centered dark-mode layout inspired by the Tailwind CSS homepage.

---

## 🏗 Architecture & Tech Stack

This project is structured as a full-stack **Monorepo**:

* **Backend (`backend/`)**:
  * **Framework**: Python 3.12, FastAPI, Uvicorn
  * **Database / Cache**: Redis (running via Docker container)
  * **LLM Clients**: Async API wrappers for Groq, Google Gemini, and OpenRouter
* **Frontend (`frontend/`)**:
  * **Framework**: React 18, TypeScript, Vite
  * **Styling**: Tailwind CSS
  * **State & Testing**: Vitest, React Testing Library, Playwright (E2E)

---

## 🏗️ Monorepo Structure

```
chat-playground/
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI pipeline (Pytest, Vitest, Playwright E2E)
├── backend/                  # Python 3.12 + FastAPI + Redis Engine
│   ├── app/
│   │   ├── api/             # SSE Chat & Arena Streaming Endpoints
│   │   ├── services/        # Provider Clients (Groq, Gemini, OpenRouter)
│   │   ├── middleware/      # IP & Device Fingerprint Rate Limiter
│   │   └── core/            # Redis Connection Pool & Config
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/                 # React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/      # UI components (Token metrics, Header, Badges)
│   │   ├── features/
│   │   │   ├── chatbox/     # Single Chat Workspace
│   │   │   └── duoarena/    # Dual Model Side-by-Side Benchmarking
│   │   ├── context/         # Daily Token & Usage Context
│   │   └── App.tsx          # Root Shell & Tab Navigation
│   ├── playwright.config.ts # Playwright E2E Configuration
│   └── package.json
└── README.md
```

## ✨ Features

### 💻 Frontend (React + TypeScript + Tailwind v4)

* **💬 Single Chat Mode:** Stream responses with model selection across multiple cloud providers (**Groq Cloud**, **Google Gemini**, **OpenRouter**).
* **⚔️ Duo Arena Mode:** Compare two models side-by-side using a single prompt to evaluate response speed, output structure, and token efficiency simultaneously.
* **📊 Real-time Metric Tracking:** Dynamic badges for input/output token usage, completion time, and progress towards the daily usage limit.
* **🎨 Vercel-Inspired UI:** Dark layout with semantic accessibility integration (`aria-pressed`, `data-testid`).
* **🛑 Stream Cancellation:** Stop generation mid-stream using native `AbortController` handles.

### ⚡ Backend (Python + FastAPI + Redis)

* **📡 Streaming Proxy Wrapper:** Unifies API responses from Groq, Gemini, and OpenRouter into Server-Sent Events (SSE).
* **🛡️ Smart Rate Limiting:** Redis-backed request and token tracking based on user IP address and client device fingerprinting.
* **🔒 Key Isolation:** Keeps API credentials secure on the server, avoiding client-side exposure.
* **⚙️ Over-Usage Prevention:** Enforces daily token limits before upstream provider requests are dispatched.


## 🚀 Local Development Setup

### Prerequisites

* **Node.js**: `v22.x` or higher
* **Python**: `v3.12+`
* **Redis**: Running instance on `localhost:6379` (or via Docker)

### 1. Backend Setup

```bash
cd backend

# Create & activate virtual environment
python -m pip install --upgrade pip
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies in editable mode
pip install -e ".[dev]"

# Create environment configuration
cp .env.example .env
```

Configure your `.env` variables in `backend/`:

```env
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# For backend logging
LOG_LEVEL=DEBUG
LOG_FILE_PATH=./logs/backend.log

# Users rate limit and daily tokens quota settings
USER_MAX_REQS_PER_MIN = 10
USER_MAX_DAILY_TOKENS = 10000
```

Start the FastAPI application server:

```bash
uvicorn app.main:app --reload --port 8686
```

### 2. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm ci

# Configure environment variables
cp .env.example .env
```

Configure your `.env` in `frontend/`:

```env
VITE_BACKEND_URL=http://localhost:8686
```

Start the frontend Vite dev server:

```bash
npm run dev
```

## 🧪 Testing Suite

### 🐍 Backend Tests (Pytest)

```bash
cd backend
python -m pytest -v
```

### ⚛️ Frontend Unit Tests (Vitest)

```bash
cd frontend
npm run test:ci
```

### 🎭 End-to-End Tests (Playwright)

```bash
cd frontend

# Install browser binaries
npx playwright install --with-deps

# Build bundle & execute E2E test suite
npm run build
npm run test:e2e
```

## ⚙️ CI/CD Pipeline (`ci.yml`)

The repository includes a GitHub Actions pipeline running on all `push` and `pull_request` triggers across main branches:

1. **`backend-test` Job:**
   * Spins up a **Redis 7 Alpine** container service with health checks.
   * Sets up Python 3.12 with pip package caching.
   * Runs the full Pytest suite.

2. **`frontend-test` Job:**
   * Sets up Node.js 22 with npm package caching.
   * Executes Vitest unit tests (`npm run test:ci`).
   * Installs Playwright Chromium binaries and builds production bundle (`npm run build`).
   * Runs Playwright E2E tests (`npm run test:e2e`).
   * Uploads Playwright test reports as artifacts on failure.

## 📝 License

This project is licensed under the [MIT License](LICENSE).
