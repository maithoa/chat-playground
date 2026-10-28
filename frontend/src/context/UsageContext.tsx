import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getUserUsage } from "@/services/llmService";

interface UsageContextType {
  tokenUsed: number;
  maxTokens: number;
  refreshUsage: () => Promise<void>;
}

const UsageContext = createContext<UsageContextType | null>(null);

export const UsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokenUsed, setTokenUsed] = useState<number>(0);
  const [maxTokens, setMaxTokens] = useState<number>(5000);

  const refreshUsage = useCallback(async () => {
    try {
      const userUsage = await getUserUsage();
      if (userUsage) {
        if (typeof userUsage.tokens_used === "number") {
          setTokenUsed(userUsage.tokens_used);
        }

        if (typeof userUsage.max_daily_tokens === "number") {
          setMaxTokens(userUsage.max_daily_tokens);
        }
      }
    } catch (error) {
      console.error("Error fetching user usage data: ", error);
    }
  }, []);

  // Fetch data when app is initiated.
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  return (
    <UsageContext.Provider value={{ tokenUsed, maxTokens, refreshUsage }}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsageContext = () => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error("userUsage must be used within a UsageProvider");
  }
  return context;
};
