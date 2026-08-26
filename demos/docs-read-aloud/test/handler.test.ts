import { describe, it, expect } from "vitest";
import { parseSpeakBody, audioHeaders, CONTENT_TYPE_MP3 } from "../src/lib/handler.ts";

// Pure request handling: the server must reject malformed bodies with the
// documented error shapes and label audio responses correctly.

describe("parseSpeakBody", () => {
  it("accepts a body with non-empty text", () => {
    expect(parseSpeakBody(JSON.stringify({ text: "  hello  " }))).toEqual({
      ok: true,
      text: "hello",
    });
  });

  it("rejects malformed JSON", () => {
    expect(parseSpeakBody("{not json")).toEqual({
      ok: false,
      status: 400,
      message: "Bad JSON body",
    });
  });

  it("rejects a missing or empty text field", () => {
    expect(parseSpeakBody("{}")).toEqual({
      ok: false,
      status: 400,
      message: "body.text is required",
    });
    expect(parseSpeakBody(JSON.stringify({ text: "   " }))).toEqual({
      ok: false,
      status: 400,
      message: "body.text is required",
    });
  });

  it("rejects a non-string text field", () => {
    expect(parseSpeakBody(JSON.stringify({ text: 42 }))).toEqual({
      ok: false,
      status: 400,
      message: "body.text is required",
    });
  });
});

describe("audioHeaders", () => {
  it("labels the audio response as MP3 with length and no-store", () => {
    const audio = Buffer.from([1, 2, 3]);
    expect(audioHeaders(audio)).toEqual({
      "content-type": "audio/mpeg",
      "content-length": "3",
      "cache-control": "no-store",
    });
    expect(CONTENT_TYPE_MP3).toBe("audio/mpeg");
  });
});
