import { defineConfig } from "@playwright/test";

const PORT = 8772;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${PORT}/clone-voice-10s`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
