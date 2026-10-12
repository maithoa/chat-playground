### Overview
Refactor Chatbox to modulized components in order to support creating Duo-Arena for comparing models performance.


### System Architecture
```mermaid

flowchart TD

LC[Layout Container in screens] --> SC[Single Chat]

LC --> DA[Duo Arena]

SC --> MC[ModelColumn: <br/> AbortController]

DA --> MCA[ModelColumn A: <br/> AbortController A]

DA --> MCB[ModelColumn B: <br/> AbortController B]

MCA --> SMA[SetState: MessagesA]

MCB --> SMB[SetState: MessagesB]

```

### Key Refactoring Goals
#### 1. Component Extraction (ModelColumn)
- Modulize message stream in UI: messages feed, auto-scroll behaviour, token counter and stop generating button
#### 2. State elevation (Duo Arena)
- Bring state of Input (where user input chat message) out to SharedInputForm to allow API calls simutaneously
- state of messages, isGenerating, aborController and bufferRef is attached with ModelColumn
