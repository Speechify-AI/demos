import { test, expect } from "@playwright/test";

const SLUG = "/live-captions";
const SHORT_TEXT = "Hello from Speechify, watch each word light up.";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("synthesizes real audio + speech marks and highlights a word on playback", async ({
  page,
}) => {
  await page.goto(SLUG);

  // Page shell renders.
  await expect(
    page.getByRole("heading", { name: /live captions/i }),
  ).toBeVisible();
  const synthesize = page.getByRole("button", { name: /synthesize/i });
  await expect(synthesize).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Short input keeps the real synthesis call cheap.
  await page.locator("#text").fill(SHORT_TEXT);

  // Kick off the primary action and capture the real API response.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/speak") && r.status() === 200,
    { timeout: 60_000 },
  );
  await synthesize.click();
  const response = await responsePromise;

  // Assert the real output: base64 audio + a non-empty speech-marks array.
  const body = (await response.json()) as {
    audio: string;
    speechMarks: Array<{ start_time: number; end_time: number; value: string }>;
  };
  expect(typeof body.audio).toBe("string");
  expect(body.audio.length).toBeGreaterThan(1000);
  expect(Array.isArray(body.speechMarks)).toBe(true);
  expect(body.speechMarks.length).toBeGreaterThan(0);
  expect(body.speechMarks[0]).toHaveProperty("value");

  // UI reflects success: captions render and the audio element gets a src.
  await expect(page.locator(".caption-line .word").first()).toBeVisible();
  const audio = page.locator("audio");
  await expect(audio).toBeVisible();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.src))
    .toMatch(/^blob:/);

  // Drive playback and assert at least one word receives the active highlight.
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = 0;
    return el.play();
  });
  await expect(page.locator(".caption-line .word.active")).toHaveCount(1, {
    timeout: 30_000,
  });
});
