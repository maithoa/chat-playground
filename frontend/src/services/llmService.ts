import type { StreamChatParams } from "../types/chat";
import { env } from "../config/env";

export async function streamChat({
    provider,
    model,
    messages,
    temperature = 0.7,
    outChunk,
    signal,
}: StreamChatParams): Promise<void> {
    /**
     * Send chat message to server and receive the streamed result back.
     */
    // Send chat message
    const chatEndpoint = `${env.API_BASE_URL}/llm/chat`;

    const response = await fetch(chatEndpoint, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({provider, model,messages, temperature}),
        signal,
    });

    // Check response
    if (!response.ok){
        const errorData = await response.json().catch(()=>({detail:"Unknown error"}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    if (!response.body){
        throw new Error ("Response body is null.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const {value, done} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value,{stream: true});

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

            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error){
                    throw new Error (parsed.error);
                }
                if (parsed.content){
                    outChunk(parsed.content)
                }

            } catch (e) {
                console.error("Failed to parse SSE payload:", dataStr, e);
            }
        }
    }
}
