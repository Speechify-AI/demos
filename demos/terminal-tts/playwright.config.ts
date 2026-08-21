import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:8769",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8769/terminal-tts",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
