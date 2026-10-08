// src/config/env.ts
let rawBaseUrl: string | undefined;

// Try import.meta.env (Vite) in a safe way
try {
  // @ts-ignore - import.meta may not exist in all environments
  rawBaseUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;
} catch (e) {
  // ignore
}

// fallback to process.env accessed via globalThis to avoid using `process` identifier directly
if (!rawBaseUrl && typeof globalThis !== "undefined") {
  rawBaseUrl = (globalThis as any)["process"]?.env?.VITE_API_BASE_URL;
}

rawBaseUrl = rawBaseUrl || "http://localhost:8686/api/v1";

export const env = {
  // strip the last slash (/) if any.
  API_BASE_URL: rawBaseUrl.replace(/\/$/, ""),
};
