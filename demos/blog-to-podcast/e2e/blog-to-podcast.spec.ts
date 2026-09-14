import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Real-API e2e. Boots the demo under `pnpm dev` and drives the core flow
// (paste article -> generate -> real Speechify audio back) against the live
// API. Guarded so a keyless CI run skips instead of failing.
test.skip(
  !process.env.SPEECHIFY_API_KEY,
  "needs SPEECHIFY_API_KEY",
);

const SLUG = "blog-to-podcast";

// Under `pnpm dev` the shared /turnstile.js asset (normally served by the
// site shell) 404s. Serve the GENUINE file from site/public — not a mock —
// so the client turnstile wiring exercises its real code path.
const TURNSTILE_CANDIDATES = [
  resolve(process.cwd(), "../../site/public/turnstile.js"),
  resolve(HERE, "../../../site/public/turnstile.js"),
];

function readGenuineTurnstile(): string {
  for (const p of TURNSTILE_CANDIDATES) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `genuine turnstile.js not found in: ${TURNSTILE_CANDIDATES.join(", ")}`,
  );
}

// Short, single-paragraph article: 2-3 sentences, well under the chunk cap,
// so it synthesizes as ONE chunk = one real synthesis call. Keeps credits low.
const SHORT_ARTICLE =
  "The best interfaces get out of your way. You reach for one, finish the job, and never think about it again. That is the whole trick.";

test("generates a podcast episode from a pasted article", async ({ page }) => {
  const turnstileJs = readGenuineTurnstile();

  // Serve the real asset for any /turnstile.js request (basePath-prefixed or not).
  await page.route("**/turnstile.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: turnstileJs,
    }),
  );

  await page.goto(`/${SLUG}`);

  // Page shell.
  await expect(
    page.getByRole("heading", {
      name: "Turn a blog post into a podcast episode.",
    }),
  ).toBeVisible();
  const textarea = page.locator("#text");
  await expect(textarea).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Paste a short article; drop the intro so it's a single chunk / one call.
  await textarea.fill(SHORT_ARTICLE);
  const introCheckbox = page.locator('input[type="checkbox"]');
  if (await introCheckbox.isChecked()) {
    await introCheckbox.uncheck();
  }

  // The button gates on Turnstile leaving the "waiting" state (the real widget
  // fires its token or error callback in headless). Wait for it to enable.
  const generate = page.getByRole("button", { name: /generate episode/i });
  await expect(generate).toBeEnabled({ timeout: 40_000 });

  // Kick off the primary action and capture the real API response.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/episode") && r.status() === 200,
    { timeout: 60_000 },
  );
  await generate.click();
  const response = await responsePromise;

  // Real output: non-empty chunks whose first chunk carries base64 mp3 audio.
  const payload = (await response.json()) as {
    chunks: { audio: string; text: string }[];
  };
  expect(Array.isArray(payload.chunks)).toBe(true);
  expect(payload.chunks.length).toBeGreaterThan(0);
  const first = payload.chunks[0];
  expect(typeof first.audio).toBe("string");
  expect(first.audio.length).toBeGreaterThan(1000);
  // base64 sanity: decodes to a non-trivial byte length.
  const bytes = Buffer.from(first.audio, "base64");
  expect(bytes.length).toBeGreaterThan(500);

  // UI reflects success: playlist populates and the status announces readiness.
  await expect(page.locator(".playlist li")).toHaveCount(payload.chunks.length);
  await expect(page.locator(".status")).toContainText(/episode ready/i);
  await expect(page.getByRole("button", { name: /play episode/i })).toBeVisible();
});
