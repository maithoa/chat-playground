# Chat Playground – Mini SaaS Product

A **fast‑api + vite/react** demo that lets a user:

* log‑in with **Google** or **GitHub** (SSO)  
* pick one of three free‑tier LLMs (OpenAI gpt‑3.5‑turbo, Anthropic claude‑2, Hugging Face distilbert‑base‑uncased)  
* chat with the model while a **token‑meter** shows live usage  
* view a **public dashboard** (no login required) that displays:  
  * total registered users  
  * logins today  
  * questions asked today  

The repository contains:

| File / folder | Purpose |
|---------------|---------|
| `app/` (created after you clone) | FastAPI backend (OAuth, model‑selection, streaming, token tracking). |
| `frontend/` | Vite‑React SPA (chat UI, dashboard, token‑meter). |
| `.github/ISSUE_TEMPLATE/` | Issue templates for **Epics**, **User Stories**, **Tasks** – use them to create the backlog. |
| `scripts/create‑board.sh` | One‑off script that creates a GitHub Project board and populates it from the issues you open. |
| `.github/workflows/seed‑board.yml` | Optional GitHub Action that runs the script automatically when the repo is first pushed. |

---

## 2️⃣ Issue templates (place under `.github/ISSUE_TEMPLATE/`)

### `epic.md`

```markdown
---
name: Epic
about: High‑level feature area – will contain a set of user stories.
labels: epic
---

# Epic – {{title}}

**Goal**  
A short one‑sentence description of the feature set.

**Success criteria**  
- [ ] List of measurable outcomes (e.g., “Backend login works for both providers”, “Docker image builds without errors”).

**Related user stories**  
- <!-- Add the issue numbers of the linked user stories after they are created -->
