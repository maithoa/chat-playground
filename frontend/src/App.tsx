import "./App.css";
import { ChatBox } from "./features/chatbox/ChatBox";

function App() {
  return (
    <div className="min-h-svh bg-gray-50 flex flex-col">
      {/* Header contains Model Selector */}
      <header className="flex-shrink-0 bg-blue-500 border-b p-4">
        <div className="flex max-w-3xl mx-auto items-center justify-between">
          <h1 className="text-xl font-bold text-white">LLM Chat Playground</h1>
        </div>
      </header>

      {/* Main Chat Interface */}
      <main className="h-screen w-screen overflow-hidden bg-gray-50 flex flex-col">
        <ChatBox />
      </main>
    </div>
  );
}

export default App;
