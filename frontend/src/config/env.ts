// src/config/env.ts
const rawBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_API_BASE_URL) ||
  "http://localhost:8686/api/v1";

export const env = {
  // strip the last slash (/) if any.
  API_BASE_URL: rawBaseUrl.replace(/\/$/, ""),
};
