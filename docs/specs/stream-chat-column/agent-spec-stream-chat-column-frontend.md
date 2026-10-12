# TASK: Refactor Single ChatBox into Modular ModelColumn for Duo-Arena Architecture

## Objective
Extract the core streaming message column from `ChatBox.tsx` into a reusable `ModelColumn.tsx` component. Refactor `ChatBox.tsx` to use `ModelColumn`, and build `DuoArena.tsx` featuring two parallel `ModelColumn` instances with a shared bottom input.

---

## Component Specifications

### 1. `ModelColumn.tsx` (Shared Component)
- **Props Interface:**
  ```typescript
  interface ModelColumnProps {
    title?: string;
    messages: Message[];
    isGenerating: boolean;
    onStop: () => void;
  }

- **Requirements:**
    - Ecapsulate `MessageList` and internal `scrollToBottom` logic
    - Include `ConversationTokenCounter` at the bottom of column
    - Include `Stop` button while streaming text from api call.

### 2. `Chatbox.tsx` (SingleModel View)
- Maintain original streaming hooks, timer logic and `AbortController`
- Pass state down to `<ModelColumn />`
- Render form input at the bottom with button `<SendMsgToModel />`, use `flex-shrink-0`

### 3. `DuoArena.tsx` (DuoModel View)
- **State Management:**
    - `input`: Shared state for the prompt input.
    - Model Column A and B : Maintain isolated `messages`, `isGenerating`, `streamingBufferRef`, `timerRef` and `abortControlRef`
- **Layout Rules:**
    - Outer root : `flex flex-col h-screen w-full overflow-hidden..`
    - Columns wrapper: `flex-1 min-h-0 flex gap-4 overflow-hidden`
    - Render 2 instances of  `<ModelColumn />` side by side
    - Shared input area at the bottom: `flex-shrink-0`
- **Strict Constraints:**
    - Ensure all flex containers maintain `min-h-0` on scrollable area and `flex-shrink-0` on fixed bottom input areas
