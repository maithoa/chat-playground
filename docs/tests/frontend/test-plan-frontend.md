# Frontend Component Test Plan

## Overview
This document summarizes the unit‑test suites for the two main frontend components of the chat‑playground application: **SendMsgToModel** and **ChatBox**.

---

## SendMsgToModel (`frontend/src/components/SendMsgToModel.test.tsx`)
| Test case | Purpose |
|-----------|---------|
| **fetches providers, allows selection, and calls `onSend`** | Verifies that the component loads provider data, opens the dropdown, picks a model and triggers `onSend` with the correct provider and model IDs. |
| **shows loading indicator while fetching** | Ensures the “Loading Models…” text appears until the provider list is resolved. |
| **displays error message on fetch failure** | Simulates a non‑OK response and checks that the warning icon and generic *Could not connect to backend.* message are rendered. |
| **renders dropdown button and opens menu** | Confirms the second button opens the provider/model menu and that the options are displayed. |
| **calls `onSend` with selected provider & model (second provider)** | Selects a model from a different provider and asserts the callback receives the correct IDs. |
| **disables both buttons when `disabled` prop is true** | Verifies the main *Send via …* button and the dropdown arrow are disabled when `disabled={true}` is passed. |

---

## ChatBox (`frontend/src/components/ChatBox.test.tsx`)
| Test case | Purpose |
|-----------|---------|
| **sends a message, streams response, and displays usage** | Types a user message, clicks *Send*, checks that the message appears, the streamed assistant reply appears, and usage data is processed (via the mocked `streamChat`). |
| **does not send when input is empty** | Ensures the *Send* button is disabled, clicking it does nothing, and no message bubbles are rendered. |
| **disables Send button while generating** | After a send, the button stays disabled during streaming and re‑enables once streaming finishes (simulated by the mock). |
| **shows Stop button while streaming and aborts on click** | Replaces the mock `streamChat` with one that never resolves, verifies the *Stop* button appears, clicks it, and confirms the abort listener is invoked. |
| **handles streaming error and shows alert** | Forces `streamChat` to throw, mocks the global `alert`, triggers a send, and checks that the alert is called with the error message and that the *Thinking* placeholder disappears. |

---

## Purpose of the Test Plan
The above test cases provide full coverage of the key interaction flows for each component, including happy‑path behavior, edge‑cases (empty input, disabled state), streaming lifecycle handling (loading, abort, error), and UI feedback (buttons, alerts). Running the test suite with `npm test` should result in **all 15 tests passing**.
