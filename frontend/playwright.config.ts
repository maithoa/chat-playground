import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173", // URL dev server của bạn
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.CI
      ? "npm run build && npx vite preview --port 5173 --host"
      : "npm run dev",
    url: "http://localhost:5173",
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
