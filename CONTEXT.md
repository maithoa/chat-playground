# Chat Playground Context

A fast‑api + Vite/React mini‑SaaS product that provides a multi‑LLM chat interface with SSO login, token‑metering, and a public usage dashboard.

## Language

**User**:
A person who interacts with the chat UI, authenticates via Google or GitHub, and asks questions to the LLM.
_Avoid_: Customer, client

**LLM**:
Large Language Model (e.g., OpenAI gpt‑3.5‑turbo, Anthropic claude‑2, Hugging Face distilbert‑base‑uncased) that generates responses to user prompts.
_Avoid_: Model, AI

**Chat**:
A session of back‑and‑forth messages between a User and an LLM, streamed via the FastAPI backend.
_Avoid_: Conversation, dialogue

**Token**:
A unit of text counted for usage billing; the token‑meter displays live consumption per user.
_Avoid_: Word, character

**Dashboard**:
A public page showing aggregate metrics such as total registered users, logins today, and questions asked today.
_Avoid_: Admin panel, report

**OAuth**:
The authentication protocol used to sign‑in users via Google or GitHub providers.
_Avoid_: Login, SSO

**FastAPI**:
The Python web framework powering the backend API, handling OAuth, model selection, streaming, and token tracking.
_Avoid_: Flask, Django

**Vite**:
The development server and bundler for the React frontend.
_Avoid_: Webpack, Parcel

**React**:
The JavaScript library used to build the SPA chat UI and dashboard.
_Avoid_: Vue, Angular