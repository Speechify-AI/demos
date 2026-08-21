import { expect, test } from "@playwright/test";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("streams real audio from the edge function", async ({ page }) => {
  await page.goto("/edge-tts");

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /edge tts/i }),
  ).toBeVisible();
  const playButton = page.getByRole("button", { name: /play/i });
  await expect(playButton).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Short input to keep the synth call small.
  await page.locator("#text").fill("Edge streaming test.");

  // Kick off the core flow and wait for the real streamed audio response.
  await playButton.click();

  await page.waitForResponse(
    (r) =>
      r.url().includes("/api/stream") &&
      r.status() === 200 &&
      (r.headers()["content-type"] ?? "").includes("audio/mpeg"),
    { timeout: 60_000 },
  );

  // UI reflects success: button leaves the loading state and the audio
  // element gets a blob src.
  await expect(playButton).toHaveText(/play/i);
  await expect(playButton).toBeEnabled();
  const audio = page.locator("audio");
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute("src", /^blob:/);

  // The client actually received real audio bytes: resolve the blob URL the
  // player is pointed at and assert it holds a non-trivial MP3 payload.
  const src = await audio.getAttribute("src");
  const byteLength = await page.evaluate(async (url) => {
    const res = await fetch(url!);
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  }, src);
  expect(byteLength).toBeGreaterThan(1000);
});
