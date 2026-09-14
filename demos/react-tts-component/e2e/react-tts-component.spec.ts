import { expect, test } from "@playwright/test";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("speaks text against the real Speechify API", async ({ page }) => {
  await page.goto("/react-tts-component");

  // Page shell renders.
  await expect(page.getByRole("heading", { name: /voice in a react app/i })).toBeVisible();
  const playButton = page.getByRole("button", { name: "Play" });
  await expect(playButton).toBeVisible();
  await expect(page.locator("#turnstile-container")).toBeAttached();

  // Keep the synthesis input short — real credits.
  await page.locator("textarea").fill("Hello from Speechify.");

  // Drive the core flow.
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/speak") && r.status() === 200,
    { timeout: 60_000 },
  );
  await playButton.click();

  const response = await responsePromise;
  const body = (await response.json()) as { audio?: string };
  expect(typeof body.audio).toBe("string");
  expect(body.audio!.length).toBeGreaterThan(1000);

  // UI reflects success: the audio element receives a data src.
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /^data:audio\/mpeg;base64,/, { timeout: 30_000 });
});
