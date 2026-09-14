import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 45_000 },
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:8782",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8782/webpage-audiobook",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
