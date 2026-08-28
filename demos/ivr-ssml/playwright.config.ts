import { defineConfig } from "@playwright/test";

// Real-API e2e: boots the demo dev server and drives the synthesize flow
// against the live Speechify API. basePath is /ivr-ssml, dev port 8770.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:8770",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8770/ivr-ssml",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
