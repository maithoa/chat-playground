import { streamChat } from "@/services/llmService";

async function main() {
  console.log("Starting stream test now...\n");

  try {
    await streamChat({
      provider: "google",
      model: "gemini-3.5-flash",
      temperature: 0.7,
      messages: [{ role: "user", content: "Xin chào, bạn là ai?" }],
      // Use console.log instead of process.stdout to avoid Node typings issue in frontend TS
      outChunk: (chunk) => console.log(chunk),
    });
    console.log("\n\n✅ Stream completed successfully!");
  } catch (error) {
    console.error("\n❌ Stream failed:", error);
  }
}

main();
