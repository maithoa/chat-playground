import { streamChat } from "../services/llmService";

async function main() {
  console.log("Starting stream test now...\n");

  try {
    await streamChat({
      provider: "google",
      model: "gemini-3.5-flash",
      messages: [{ role: "user", content: "Xin chào, bạn là ai?" }],
      outChunk: (chunk) => process.stdout.write(chunk),
    });
    console.log("\n\n✅ Stream completed successfully!");
  } catch (error) {
    console.error("\n❌ Stream failed:", error);
  }
}

main();
