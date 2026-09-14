import { expect, test } from "@playwright/test";

test.skip(!process.env.SPEECHIFY_API_KEY, "needs SPEECHIFY_API_KEY");

test("synthesizes a non-English language against the real Speechify API", async ({ page }) => {
  await page.goto("/multilingual-tts");

  await expect(
    page.getByRole("heading", { name: /text-to-speech in 30\+ languages/i }),
  ).toBeVisible();

  // Default language is French; confirm the picker and sample are wired.
  const select = page.locator("select");
  await expect(select).toHaveValue("fr-FR");
  await expect(page.locator("textarea")).toHaveValue(/Speechify en français/);

  // Switch to German to prove the language parameter drives the request.
  await select.selectOption("de-DE");
  await expect(page.locator("textarea")).toHaveValue(/auf Deutsch/);

  const speak = page.getByRole("button", { name: "Speak" });
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/speak") && r.status() === 200,
    { timeout: 60_000 },
  );
  await speak.click();

  const response = await responsePromise;
  const body = (await response.json()) as { audio?: string };
  expect(typeof body.audio).toBe("string");
  expect(body.audio!.length).toBeGreaterThan(1000);

  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /^data:audio\/mpeg;base64,/, { timeout: 30_000 });
});
