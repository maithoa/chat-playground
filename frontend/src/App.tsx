import { useState } from "react";
import "./App.css";
import { ChatBox } from "./features/chatbox/ChatBox";
import { DuoArena } from "./features/duoarena/DuoArena";

function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "arena">("chat");
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header contains Model Selector */}
      <header className="flex-shrink-0 bg-blue-500 border-b p-4 flex flex-col">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">LLM Chat Playground</h1>
        </div>
        {/* Tab Switcher */}
        <nav className="flex items-center gap-1 bg-blue-700/60 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "chat"
                ? "bg-white text-blue-600 shadow-sm font-semibold"
                : "text-blue-100 hover:text-white hover:bg-blue-700/50"
            }`}
          >
            Single Chat
          </button>
          <button
            onClick={() => setActiveTab("arena")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "arena"
                ? "bg-white text-blue-600 shadow-sm font-semibold"
                : "text-blue-100 hover:text-white hover:bg-blue-700/50"
            }`}
          >
            Duo Arena
          </button>
        </nav>
      </header>

      {/* Main Chat Interface */}
      <main className="flex-1 min-h-0 bg-gray-50 flex flex-col items-center w-full overflow-hidden">
        {activeTab === "chat" ? <ChatBox /> : <DuoArena />}
      </main>
    </div>
  );
}

export default App;
