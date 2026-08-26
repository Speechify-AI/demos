import { describe, it, expect } from "vitest";
import {
  shouldReadAloud,
  uploadTitle,
  failureMessage,
  UPLOAD_FILENAME,
  TITLE_MAX_CHARS,
  type SlackMessageEvent,
} from "../src/lib/message.ts";

// Pure handler rules: the bot must read real user messages and stay quiet
// for everything else (its own uploads, other bots, edits, joins, threads).

describe("shouldReadAloud", () => {
  it("reads a plain user message in a channel", () => {
    expect(
      shouldReadAloud({ type: "message", channel: "C123", text: "hello there" }),
    ).toBe(true);
  });

  it("ignores non-message events", () => {
    expect(shouldReadAloud({ type: "reaction_added", channel: "C123", text: "x" })).toBe(false);
    expect(shouldReadAloud({ type: undefined, channel: "C123", text: "x" })).toBe(false);
  });

  it("ignores message subtypes (edits, joins, thread broadcasts)", () => {
    expect(
      shouldReadAloud({ type: "message", subtype: "message_changed", channel: "C123", text: "x" }),
    ).toBe(false);
  });

  it("ignores bot traffic, including its own file uploads", () => {
    expect(shouldReadAloud({ type: "message", bot_id: "B1", channel: "C123", text: "x" })).toBe(false);
  });

  it("ignores messages without a channel or with blank text", () => {
    expect(shouldReadAloud({ type: "message", channel: "", text: "x" })).toBe(false);
    expect(shouldReadAloud({ type: "message", channel: "C123", text: "   " })).toBe(false);
  });
});

describe("uploadTitle", () => {
  it("previews the message and caps at the title limit", () => {
    expect(uploadTitle("hello")).toBe("Read aloud: hello");
    const long = uploadTitle("x".repeat(500));
    expect(long.length).toBeLessThanOrEqual("Read aloud: ".length + TITLE_MAX_CHARS);
  });
});

describe("failureMessage", () => {
  it("tells the channel why synthesis failed", () => {
    expect(failureMessage("hi", "bad key")).toBe("I couldn't read that aloud: bad key");
  });
});

describe("constants", () => {
  it("uses a stable upload filename", () => {
    expect(UPLOAD_FILENAME).toBe("read-aloud.mp3");
  });
});
