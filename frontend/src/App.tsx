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
      <main className="flex flex-1 min-h-0 max-w-3xl w-full mx-auto p-4 ">
        <ChatBox />
      </main>
    </div>
  );
}

export default App;
