import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Real-API e2e: boots the demo (pnpm dev) and drives the terminal against the
// live Speechify API. No mocking of Turnstile or the API — the only intercept
// is serving the genuine shared turnstile.js, which 404s under `pnpm dev`
// because it is only present on the hosted site, not in this demo's public dir.
const SLUG = "/terminal-tts";

// Locate the genuine shared client helper (demos/site/public/turnstile.js) by
// walking up from here — resilient whether the demo is checked out normally or
// inside a git worktree. We serve the real asset locally, never a mock.
function findTurnstileJs(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, "site", "public", "turnstile.js");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("could not locate demos/site/public/turnstile.js");
}

const TURNSTILE_JS = readFileSync(findTurnstileJs(), "utf8");

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("terminal synthesizes real audio from a say command", async ({ page }) => {
  await page.route("**/turnstile.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: TURNSTILE_JS,
    }),
  );

  await page.goto(SLUG);

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /TTS from your terminal/i }),
  ).toBeVisible();
  const input = page.getByRole("textbox", { name: "Command input" });
  await expect(input).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Drive the core flow: run one synthesis command.
  await input.click();
  await input.fill('speechify say "hello from speechify" --voice geffen_32');

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/say") && r.status() === 200,
      { timeout: 60_000 },
    ),
    input.press("Enter"),
  ]);

  // Real output: a non-trivial base64 audio payload.
  const body = (await response.json()) as { audio?: string; voiceId?: string };
  expect(body.audio, "response carries base64 audio").toBeTruthy();
  expect(
    (body.audio ?? "").length,
    "base64 audio is non-trivial",
  ).toBeGreaterThan(2000);
  expect(body.voiceId).toBe("geffen_32");

  // UI reflects success: the terminal prints an ok line and an audio element
  // gets a real (blob) src.
  await expect(page.locator(".line.ok")).toContainText(/played/i, {
    timeout: 30_000,
  });
  const audio = page.locator("audio.player");
  await expect(audio).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });

  // Input returns from its busy state.
  await expect(input).toBeEnabled();
});
