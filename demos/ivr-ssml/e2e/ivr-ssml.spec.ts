import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Real-API e2e: boots `pnpm dev` and drives the synthesize flow against the
// live Speechify API. No mocking of the API or of Turnstile behaviour.
//
// The demo's layout loads the shared Turnstile client from the site root
// (`<script src="/turnstile.js">`). When hosted, demos.speechify.ai serves that
// file for every demo; a standalone `pnpm dev` has no site root, so we serve the
// *genuine* site asset to the browser. It's the real script — on localhost
// Cloudflare rejects the domain (error 110200), the widget fails open exactly as
// in production, and the request goes out tokenless. The server's verifyTurnstile
// also fails open locally (no TURNSTILE_SECRET_KEY), so the call reaches the API.
const dir = path.dirname(fileURLToPath(import.meta.url));
const turnstileFile = path.resolve(dir, "../../../site/public/turnstile.js");

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("synthesizes an SSML IVR line against the real API", async ({ page }) => {
  await page.route("**/turnstile.js", (route) =>
    route.fulfill({
      path: turnstileFile,
      contentType: "application/javascript",
    }),
  );

  await page.goto("/ivr-ssml");

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /IVR pronunciation with SSML/i }),
  ).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Default state is the "Caller name" preset in SSML mode — prove it's real
  // SSML by checking the editable markup carries a <phoneme> tag.
  const ssml = page.locator("#ssml");
  await expect(ssml).toBeVisible();
  await expect(ssml).toHaveValue(/<phoneme/);

  // Primary action becomes clickable once Turnstile settles (fails open here).
  const synth = page.locator("button.btn-primary");
  await expect(synth).toBeEnabled({ timeout: 30_000 });

  // Kick off one synthesis and capture the real API response.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/speak") && r.status() === 200,
    { timeout: 60_000 },
  );
  await synth.click();

  const res = await responsePromise;
  const body = (await res.json()) as {
    audio?: string;
    billableCharactersCount?: number | null;
  };

  // Real output: a non-trivial base64 MP3 payload.
  expect(typeof body.audio).toBe("string");
  expect((body.audio ?? "").length).toBeGreaterThan(2000);

  // UI reflects success: the audio element mounts with a data-URI src and the
  // button leaves its loading state.
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /^data:audio\/mpeg;base64,/);
  await expect(synth).toBeEnabled();
  await expect(page.locator(".status")).toContainText(/Done/i);
});
