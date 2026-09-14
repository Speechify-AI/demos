import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "/streaming-tts-karaoke";
const here = dirname(fileURLToPath(import.meta.url));
// The shared Turnstile helper is served at the domain root only when hosted;
// under `pnpm dev` it 404s. Serve the GENUINE file so the real widget code runs
// (it fails open on localhost, exactly like production). Not a mock.
const TURNSTILE_JS = readFileSync(join(here, "..", "..", "..", "site", "public", "turnstile.js"), "utf8");

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("streams real audio + word marks and highlights words as they arrive", async ({ page }) => {
  await page.route("**/turnstile.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: TURNSTILE_JS }),
  );

  await page.goto(`${BASE}`);
  await expect(page.getByRole("heading", { name: /streaming tts/i })).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Start streaming and confirm the real SSE endpoint responds.
  const sse = page.waitForResponse(
    (r) => r.url().includes("/api/stream") && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /stream it/i }).click();
  const res = await sse;
  expect(res.headers()["content-type"]).toContain("text/event-stream");

  // The "received" highlight proves word marks arrived over the wire and mapped
  // onto the rendered text.
  await expect(page.locator(".w.received").first()).toBeVisible({ timeout: 45_000 });
  expect(await page.locator(".w.received").count()).toBeGreaterThan(1);

  // Audio element got a source (MediaSource object URL or a buffered blob).
  await expect
    .poll(async () => page.locator("audio").evaluate((el: HTMLAudioElement) => el.src), {
      timeout: 45_000,
    })
    .toMatch(/^blob:/);
});
