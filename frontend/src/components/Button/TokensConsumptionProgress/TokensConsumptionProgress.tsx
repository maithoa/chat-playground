import React, { useEffect, useState } from "react";
import { getUserUsage } from "@/services/llmService";

export interface TokensConsumptionProgressProps {
  refreshTrigger?: number;
}

export const TokensConsumptionProgress: React.FC<TokensConsumptionProgressProps> = ({
  refreshTrigger = 0,
}) => {
  // component props
  const [internalTokenUsed, setInternalTokenUsed] = useState<number>(0);
  const [max, setMax] = useState<number>(5000);

  // Fetch backend api to find out the token used and max allowed for the current device based on ip, device information and datetime
  useEffect(() => {
    async function fetchUserUsage() {
      try {
        const userUsage = await getUserUsage();
        if (userUsage) {
          if (typeof userUsage.tokens_used === "number") {
            setInternalTokenUsed(userUsage.tokens_used);
          }
          if (typeof userUsage.max_daily_tokens === "number") {
            setMax(userUsage.max_daily_tokens);
          }
        }
      } catch (e) {
        console.log("Error getting user's daily usage data:", e);
        throw Error("Could not fetch user's daily usage data.");
      }
    }
    fetchUserUsage();
  }, [refreshTrigger]);

  const currentUsed = internalTokenUsed;

  const percentage = Math.min(Math.max((currentUsed / max) * 100, 0), 100);
  const isAlmostEmpty = percentage >= 80;

  return (
    <div className="w-full bg-gray-100 p-3 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
        <span>Your daily token used</span>
        <span className={isAlmostEmpty ? "text-red-600 font-bold" : "text-gray-800"}>
          {currentUsed.toLocaleString()} / {max.toLocaleString()} tokens
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
