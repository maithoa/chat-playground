import "./App.css";
import { ChatBox } from "./features/chatbox/ChatBox";

function App() {
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header contains Model Selector */}
      <header className="flex-shrink-0 bg-blue-500 border-b p-4 flex flex-col">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">LLM Chat Playground</h1>
        </div>
      </header>

      {/* Main Chat Interface */}
      <main className="flex-1 min-h-0 bg-gray-50 flex flex-col items-center w-full overflow-hidden">
        <ChatBox />
      </main>
    </div>
  );
}

export default App;
