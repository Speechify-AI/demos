import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Genuine shared Turnstile client. Under `pnpm dev` the demo app does not serve
// the site's /turnstile.js (it lives in the site service's public dir), so it
// 404s. We intercept the request and serve the REAL asset — not a mock — so the
// client behaves exactly as in production. The server fail-opens locally
// (TURNSTILE_SECRET_KEY unset), so the request still succeeds without a solved
// widget; getToken() just waits out its ~15s timeout in headless.
const TURNSTILE_JS = readFileSync(
  fileURLToPath(new URL("../../../site/public/turnstile.js", import.meta.url)),
  "utf8",
);

const SAMPLE_WAV = fileURLToPath(
  new URL("../fixtures/spacewalk.wav", import.meta.url),
);

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("clone → speak → delete against the real API", async ({ page }) => {
  // Cloning can take 20-40s, and each gated request waits out the ~15s
  // Turnstile getToken timeout in headless. Give the full lifecycle room.
  test.setTimeout(180_000);

  await page.route("**/turnstile.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: TURNSTILE_JS,
    }),
  );

  await page.goto("/clone-voice-10s");

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /clone a voice from 10 seconds/i }),
  ).toBeVisible();
  const runButton = page.getByRole("button", {
    name: /clone, speak, then delete/i,
  });
  await expect(runButton).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Consent gate: full name + email + checkbox, then the bundled sample.
  await page.locator("#fullName").fill("Ada Lovelace");
  await page.locator("#email").fill("ada@example.com");
  await page.locator("label.check input[type=checkbox]").check();
  await page.locator("#sample").setInputFiles(SAMPLE_WAV);

  // Arm the three real-API responses before kicking off the one lifecycle run.
  const clonePromise = page.waitForResponse(
    (r) => r.url().includes("/api/clone") && r.status() === 200,
    { timeout: 90_000 },
  );
  const speakPromise = page.waitForResponse(
    (r) => r.url().includes("/api/speak") && r.status() === 200,
    { timeout: 90_000 },
  );
  const deletePromise = page.waitForResponse(
    (r) =>
      r.url().includes("/api/voice") &&
      r.request().method() === "DELETE" &&
      r.status() === 200,
    { timeout: 90_000 },
  );

  await expect(runButton).toBeEnabled();
  await runButton.click();

  // 1. Clone — real voiceId minted.
  const cloneRes = await clonePromise;
  const cloneBody = await cloneRes.json();
  expect(typeof cloneBody.voiceId).toBe("string");
  expect(cloneBody.voiceId.length).toBeGreaterThan(0);

  // 2. Speak — real base64 mp3 from the cloned voice.
  const speakRes = await speakPromise;
  const speakBody = await speakRes.json();
  expect(typeof speakBody.audio).toBe("string");
  expect(speakBody.audio.length).toBeGreaterThan(1000);

  // 3. Delete — the clone is removed, leaving no litter.
  const deleteRes = await deletePromise;
  const deleteBody = await deleteRes.json();
  expect(deleteBody.deleted).toBe(cloneBody.voiceId);

  // UI reflects success: audio element gets a src, the run leaves loading state.
  await expect(page.locator("audio")).toHaveAttribute("src", /.+/, {
    timeout: 30_000,
  });
  await expect(runButton).toBeEnabled();
});
