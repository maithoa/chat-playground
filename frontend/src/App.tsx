import { useState } from 'react'
import { ModelSelector } from './components/ModelSelector';
import './App.css'
import { ChatBox } from './components/ChatBox';

function App() {
  const [selected, setSelected] = useState<{ provider: string; model: string }>({
    provider: "",
    model: "",
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header contains Model Selector */}
      <header className="bg-white border-b p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">LLM Chat Playground</h1>
          <ModelSelector
            onSelect={(providerId, modelId) => {
              setSelected({ provider: providerId, model: modelId });
            }}
          />
        </div>
      </header>

      {/* Main Chat Interface */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4">
        <ChatBox
          provider={selected.provider}
          model={selected.model}
        />
      </main>
    </div>
  );
}

export default App
