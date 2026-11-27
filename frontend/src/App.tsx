import {
  analyticsAvailable,
  analyticsPreference,
  recordAction,
  recordVisit,
  setAnalyticsPreference,
} from "./analytics";
import { useEffect, useState } from "react";
import "./App.css";
import { ChatBox } from "./features/chatbox/ChatBox";
import { DuoArena } from "./features/duoarena/DuoArena";
import { UsageProvider } from "./context/UsageContext";
import { TokensConsumptionProgress } from "./components/Button/TokensConsumptionProgress";

function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "arena">("chat");

  const [preference, setPreference] = useState(analyticsPreference);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    recordVisit();
  }, []);

  function chooseAnalytics(allow: boolean) {
    setAnalyticsPreference(allow);
    setPreference(allow ? "yes" : "no");
    setShowPreferences(false);
    if (allow) recordVisit();
  }

  return (
    <UsageProvider>
      <div className="h-screen w-full bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white font-sans relative flex flex-col overflow-hidden">
        {/* 1. LAYER NỀN: Radial Grid Background (Lưới chìm) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />

        {/* 2. LAYER NỀN: Ambient Glow (Đốm sáng phát quang) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-purple-500/0 blur-[100px] rounded-full pointer-events-none z-0" />

        {/* 3. HEADER: Không khung, không viền, blend trực tiếp vào background, thoáng và to hơn */}
        <header className="relative z-10 flex-shrink-0 px-8 py-6 flex flex-col gap-4">
          <div className="w-full flex items-center justify-between">
            {/* Title với hiệu ứng Gradient Text */}
            <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400">
              LLM Chat Playground
            </h1>

            {/* Tab Switcher kiểu Glass Badge */}
            <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => {
                  recordAction("open_single_chat");
                  setActiveTab("chat");
                }}
                aria-pressed={activeTab === "chat"}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                Single Chat
              </button>
              <button
                onClick={() => {
                  recordAction("open_duo_arena");
                  setActiveTab("arena");
                }}
                aria-pressed={activeTab === "arena"}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === "arena"
                    ? "bg-slate-800 text-sky-400 shadow-sm border border-slate-700/60 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                Duo Arena
              </button>
            </nav>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full relative z-10">
            <TokensConsumptionProgress />
          </div>
        </header>

        {analyticsAvailable && (
          <aside
            aria-label="Usage analytics"
            className="relative z-10 px-8 pb-2 text-xs text-slate-300"
          >
            {showPreferences || preference === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <p>
                  May we count visits and button clicks with PostHog? We don’t send
                  prompts or replies.
                </p>
                <button
                  type="button"
                  className="underline"
                  onClick={() => chooseAnalytics(true)}
                >
                  Allow analytics
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => chooseAnalytics(false)}
                >
                  No thanks
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="underline"
                onClick={() => setShowPreferences(true)}
              >
                Analytics preferences
              </button>
            )}
          </aside>
        )}

        {/* 4. MAIN CONTENT */}
        <main className="relative z-10 flex-1 min-h-0 bg-transparent flex flex-col items-center w-full overflow-hidden">
          {activeTab === "chat" ? <ChatBox /> : <DuoArena />}
        </main>
      </div>
    </UsageProvider>
  );
}

export default App;
