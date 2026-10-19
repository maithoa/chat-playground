import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/tests/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"], // Define where is the unit test
    exclude: ["tests/e2e/**", "node_modules/**"], // Exclude vitest out of tests/e2e/*
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
