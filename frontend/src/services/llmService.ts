import type { StreamChatParams } from "@/types/chat";
import { env } from "@/config/env";
import { getSessionId, getDeviceFingerprint } from "./commonService";
import type { UserUsage } from "@/types/llm";

export async function streamChat({
  provider,
  model,
  messages,
  outChunk,
  onUsageComplete,
  signal,
}: StreamChatParams): Promise<void> {
  /**
   * Send chat message to server and receive the streamed result back.
   */
  // Send chat message
  const chatEndpoint = `${env.API_BASE_URL}/llm/chat`;

  const device_ip = await getDeviceFingerprint();

  let response: Response;
  try {
    response = await fetch(chatEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": getSessionId(),
        "x-device-fp": device_ip,
      },
      body: JSON.stringify({ provider, model, messages }),
      signal,
    });
  } catch (networkError) {
    console.error("Network error:", networkError);
    throw new Error("Cannot connect to server, please try again later.");
  }

  // Check response
  if (!response?.ok) {
    let errorDetail = "Unknown error";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch (error) {
      errorDetail = "Error: ${response.status}:${response.statusText} ";
    }
    throw new Error(errorDetail);
  }

  if (!response?.body) {
    throw new Error("Response body is null.");
  }

  const reader = response?.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Separate buffer using SSE delimiter (\n\n)
    const lines = buffer.split("\n\n");

    // Last row might not yet fully streamed back, keep it in buffer for next read
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataStr = trimmed.replace(/^data:\s*/, "");

      // end signal from backend
      if (dataStr === "[DONE]") return;

      // Parse Server Stream payload
      try {
        const parsed = JSON.parse(dataStr);
        console.log("-----DEBUG---- dataStr:", { parsed });
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.content) {
          outChunk(parsed.content);
        }
        if (parsed.usage) {
          console.log("-----DEBUG---- parsed usage:", parsed.usage);
          onUsageComplete(parsed.usage);
        }
      } catch (e) {
        console.error("Failed to parse SSE payload:", dataStr, e);
      }
    }
  }
}

export async function getUserUsage(): Promise<UserUsage> {
  const beEndpoint = `${env.API_BASE_URL}/llm/userUsage`;

  const device_ip = await getDeviceFingerprint();

  let response: Response;
  try {
    response = await fetch(beEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": getSessionId(),
        "x-device-fp": device_ip,
      },
    });
  } catch (networkError) {
    console.error("Network error:", networkError);
    throw new Error("Cannot connect to server, please try again later.");
  }

  // Check response
  if (!response.ok) {
    let errorDetail = "Unknown error";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch (error) {
      errorDetail = `Error: ${response.status}:${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}
