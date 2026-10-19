import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173", // URL dev server của bạn
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.CI
      ? "npx vite preview --port 5173 --host 127.0.0.1"
      : "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
} as any);
