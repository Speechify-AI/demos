import { expect, test } from "@playwright/test";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("fetches a real webpage and narrates it against the live Speechify API", async ({ page }) => {
  await page.goto("/webpage-audiobook");

  await expect(
    page.getByRole("heading", { name: /turn any webpage into an audiobook/i }),
  ).toBeVisible();

  // A stable, content-rich public page. Long articles are capped server-side.
  await page.locator('input[type="url"]').fill("https://en.wikipedia.org/wiki/Speech_synthesis");

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/audiobook") && r.status() === 200,
    { timeout: 90_000 },
  );
  await page.getByRole("button", { name: /convert to audiobook/i }).click();

  const response = await responsePromise;
  const body = (await response.json()) as { title?: string; chunks?: { audio: string }[] };
  expect(Array.isArray(body.chunks)).toBe(true);
  expect(body.chunks!.length).toBeGreaterThan(0);
  expect(body.chunks![0].audio.length).toBeGreaterThan(1000);

  // The play button appears once chunks are ready.
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});
