import React from "react";
import { useUsageContext } from "@/context/UsageContext";

export const TokensConsumptionProgress: React.FC = () => {
  // get states from UsageContext
  const { tokenUsed, maxTokens } = useUsageContext();

  const percentage = Math.min(Math.max((tokenUsed / maxTokens) * 100, 0), 100);
  const isAlmostEmpty = percentage >= 80;

  return (
    <div className="w-full bg-gray-100 p-3 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
        <span>Your daily token used</span>
        <span className={isAlmostEmpty ? "text-red-600 font-bold" : "text-gray-800"}>
          {tokenUsed.toLocaleString()} / {maxTokens.toLocaleString()} tokens
        </span>
      </div>

      {/* Thanh progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${
            isAlmostEmpty ? "bg-red-500 animate-pulse" : "bg-blue-600"
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
