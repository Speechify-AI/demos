import { defineConfig } from "@playwright/test";

// Real-API e2e: boots the demo under `pnpm dev` and drives the core flow
// against the live Speechify API. The dev server is mounted under the demo's
// basePath, so the ready-check URL is prefixed with /blog-to-podcast.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:8773",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8773/blog-to-podcast",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
