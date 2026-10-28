import React from "react";
import { useUsageContext } from "@/context/UsageContext";

export const TokensConsumptionProgress: React.FC = () => {
  const { tokenUsed, maxTokens } = useUsageContext();

  const percentage = Math.min(Math.max((tokenUsed / maxTokens) * 100, 0), 100);
  const isAlmostEmpty = percentage >= 80;

  return (
    <div className="w-full px-6 py-3 relative z-10">
      <div className="w-full flex flex-col gap-2">
        <div className="flex justify-between text-xs font-medium text-slate-400">
          <span className="tracking-wide">Daily token usage</span>
          <span
            className={
              isAlmostEmpty
                ? "text-rose-400 font-semibold animate-pulse"
                : "text-slate-200 font-mono"
            }
          >
            {tokenUsed.toLocaleString()} / {maxTokens.toLocaleString()} tokens
          </span>
        </div>

        {/* Thanh progress tràn viền thanh thoát */}
        <div className="w-full h-1.5 bg-slate-800/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAlmostEmpty
                ? "bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse"
                : "bg-sky-500 shadow-sm shadow-sky-500/50"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
