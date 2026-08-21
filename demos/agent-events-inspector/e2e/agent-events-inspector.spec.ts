import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Real-API e2e: boots `pnpm dev` and drives the inspector against the live
// Speechify Voice Agents API. No mocking of the API or of Turnstile behaviour.
//
// The demo's layout loads the shared Turnstile client from the site root
// (`<script src="/turnstile.js">`). When hosted, demos.speechify.ai serves that
// file for every demo; a standalone `pnpm dev` has no site root, so we serve the
// *genuine* site asset to the browser. It's the real script — on localhost
// Cloudflare rejects the domain, the widget fails open exactly as in production,
// and the request goes out tokenless. The server's verifyTurnstile also fails
// open locally (no TURNSTILE_SECRET_KEY), so the call reaches the real API.
const dir = path.dirname(fileURLToPath(import.meta.url));
const turnstileFile = path.resolve(dir, "../../../site/public/turnstile.js");

const SLUG = "/agent-events-inspector";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("replays the sample timeline and lists real conversations from the API", async ({
  page,
}) => {
  await page.route("**/turnstile.js", (route) =>
    route.fulfill({
      path: turnstileFile,
      contentType: "application/javascript",
    }),
  );

  await page.goto(SLUG);

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /voice agent events inspector/i }),
  ).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Default "Replay sample" tab renders a timeline with at least one event row.
  const sampleTab = page.getByRole("button", { name: /replay sample/i });
  await expect(sampleTab).toHaveClass(/on/);
  await expect(page.locator(".timeline .evt").first()).toBeVisible();
  expect(await page.locator(".timeline .evt").count()).toBeGreaterThan(0);

  // Switch to the live "Inspect a conversation" tab.
  await page.getByRole("button", { name: /inspect a conversation/i }).click();
  const fetchBtn = page.getByRole("button", { name: /^fetch$/i });
  await expect(fetchBtn).toBeVisible();

  // Fetch with a blank id → lists recent conversations from the real API.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/conversation") && r.status() === 200,
    { timeout: 60_000 },
  );
  await fetchBtn.click();
  const response = await responsePromise;

  // Real-API assertion: the body carries a `conversations` array. An empty
  // array from the live Voice Agents API is a valid pass.
  const body = (await response.json()) as { conversations?: unknown };
  expect(Array.isArray(body.conversations)).toBe(true);

  // UI leaves the loading state.
  await expect(fetchBtn).toHaveText(/fetch/i);
});
