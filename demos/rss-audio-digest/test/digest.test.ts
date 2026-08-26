import { describe, it, expect } from "vitest";
import { buildDigest, chunkText, isToday, type FeedOutput } from "../src/lib/digest.ts";

describe("isToday", () => {
  const now = new Date("2026-08-26T12:00:00Z");

  it("accepts a pubDate within today (UTC)", () => {
    expect(isToday("2026-08-26T09:00:00Z", now)).toBe(true);
  });

  it("rejects other days and invalid dates", () => {
    expect(isToday("2026-08-25T09:00:00Z", now)).toBe(false);
    expect(isToday(undefined, now)).toBe(false);
    expect(isToday("not-a-date", now)).toBe(false);
  });
});

describe("buildDigest", () => {
  const feed: FeedOutput = {
    title: "Example Feed",
    items: [
      { title: "Post one", contentSnippet: "First sentence. Second sentence. Third sentence." },
      { title: "Post two", contentSnippet: "Another first. Another second." },
    ],
  };

  it("opens with the digest intro", () => {
    const text = buildDigest(feed, "Example Feed", { today: false, latest: 0 });
    expect(text.startsWith("Your daily digest for Example Feed.")).toBe(true);
  });

  it("includes each title and only the first two snippet sentences", () => {
    const text = buildDigest(feed, "Example Feed", { today: false, latest: 0 });
    expect(text).toContain("Post one");
    expect(text).toContain("First sentence. Second sentence.");
    expect(text).not.toContain("Third sentence");
    expect(text).toContain("Post two");
  });

  it("caps the number of items with latest", () => {
    const text = buildDigest(feed, "Example Feed", { today: false, latest: 1 });
    expect(text).toContain("Post one");
    expect(text).not.toContain("Post two");
  });

  it("filters to items published today", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    const dated: FeedOutput = {
      items: [
        { title: "Today", pubDate: "2026-08-26T09:00:00Z" },
        { title: "Yesterday", pubDate: "2026-08-25T09:00:00Z" },
      ],
    };
    const text = buildDigest(dated, "Dated", { today: true, latest: 0 });
    expect(text).toContain("Today");
    expect(text).not.toContain("Yesterday");
  });

  it("throws when the filter matches nothing", () => {
    expect(() =>
      buildDigest({ items: [] }, "Empty", { today: false, latest: 0 }),
    ).toThrow("No items found in Empty.");
    expect(() =>
      buildDigest({ items: [{ title: "Old", pubDate: "2026-08-25T09:00:00Z" }] }, "Dated", {
        today: true,
        latest: 0,
      }),
    ).toThrow("No items published today in Dated.");
  });
});

describe("chunkText", () => {
  it("keeps short text in one chunk", () => {
    expect(chunkText("Hello world.")).toEqual(["Hello world."]);
  });

  it("never produces a chunk over the speech endpoint's 2,000-char cap", () => {
    const sentence = "This is a sentence of roughly fifty characters. ".repeat(6);
    const text = sentence.repeat(20);
    for (const chunk of chunkText(text)) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it("splits on sentence boundaries", () => {
    const chunks = chunkText("One two. Three four.");
    expect(chunks.join(" ")).toContain("One two.");
    expect(chunks.join(" ")).toContain("Three four.");
  });
});
