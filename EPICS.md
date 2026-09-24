# Epics and User Stories

## Epic 1: User Authentication & Session Management
- **Goal**: Allow any internet user to sign-in with Google or GitHub and maintain a chat session.

### User Stories
1. **As a User**, I can click a "Sign in with Google" button and be redirected to Google OAuth, then return to the app logged in.
2. **As a User**, I can click a "Sign in with GitHub" button and be redirected to GitHub OAuth, then return to the app logged in.
3. **As a User**, after signing in I see my username and can start a new chat session.
4. **As a User**, my authentication state persists across page reloads.

## Epic 2: Multi-LLM Selection & Interaction
- **Goal**: Let users choose a free LLM, ask questions, and see the model's response, token usage, and processing time.

### User Stories
1. **As a User**, I can select a model (e.g., OpenAI gpt-3.5-turbo, Anthropic claude-2, HuggingFace distilbert) from a dropdown.
2. **As a User**, I can type a question and submit it to the selected model.
3. **As a User**, I see the model's answer streamed in the chat UI.
4. **As a User**, I see how many tokens were consumed for my request.
5. **As a User**, I see how long the request took to process.

## Epic 3: Public Dashboard & Analytics
- **Goal**: Show aggregate usage statistics on the home page.

### User Stories
1. **As a Visitor**, I can see the total number of registered users.
2. **As a Visitor**, I can see the number of users logged in today.
3. **As a Visitor**, I can see the total number of questions asked.
4. **As a Visitor**, I can see a breakdown of which LLMs have been used most.

## Epic 4: Team Workflow Automation
- **Goal**: Automate creation of GitHub issues/epics from this document and set up a sprint board.

### User Stories
1. **As a Team Lead**, I can run a script that reads EPICS.md and creates corresponding GitHub Issues in the repository.
2. **As a Team Lead**, I can link those issues to a GitHub Project board for sprint planning.
3. **As a Team Lead**, I can add labels (e.g., `frontend`, `backend`, `infra`) automatically based on the epic.

---
*All stories are written in the format "As a ... I can ..." to be ready for conversion into GitHub Issues.*