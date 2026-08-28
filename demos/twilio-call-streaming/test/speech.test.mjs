import { describe, it, expect } from "vitest";
import { twiml } from "../twiml.mjs";
import {
  SPEECH_STREAM_URL,
  SUPPORTED_MODELS,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  TWILIO_OUTPUT_FORMAT,
  STREAM_ACCEPT_HEADER,
  buildStreamRequest,
  StreamValidationError,
} from "../speech.mjs";

// These tests pin the demo to the live API contract in
// https://docs.speechify.ai/build/api-reference/v1/audio/stream. If a
// documented value changes, the constants here must move with it.

describe("POST /v1/audio/stream endpoint (docs)", () => {
  it("points at the documented endpoint", () => {
    expect(SPEECH_STREAM_URL).toBe("https://api.speechify.ai/v1/audio/stream");
  });
});

describe("model enum (docs: simba-3.0, simba-3.2)", () => {
  it("offers exactly the two current Simba 3 models", () => {
    expect([...SUPPORTED_MODELS].sort()).toEqual(["simba-3.0", "simba-3.2"]);
  });

  it("defaults to the docs' recommended English model simba-3.2", () => {
    expect(DEFAULT_MODEL).toBe("simba-3.2");
    expect(DEFAULT_VOICE).toBe("geffen_32");
  });

  it("rejects the retired Simba 1.6 models", () => {
    for (const retired of ["simba-english", "simba-multilingual"]) {
      expect(() => buildStreamRequest({ text: "hi", model: retired })).toThrow(
        StreamValidationError,
      );
    }
  });
});

describe("output_format (docs: ulaw_8000)", () => {
  it("requests Twilio's native format", () => {
    expect(TWILIO_OUTPUT_FORMAT).toBe("ulaw_8000");
    const request = buildStreamRequest({ text: "hi" });
    expect(request.output_format).toBe("ulaw_8000");
  });

  it("sends the Accept header the docs assign to u-law responses", () => {
    expect(STREAM_ACCEPT_HEADER).toBe("audio/basic");
  });
});

describe("input rules (docs: 20,000-char stream cap)", () => {
  it("rejects empty input", () => {
    expect(() => buildStreamRequest({ text: "   " })).toThrow(StreamValidationError);
  });

  it("accepts input at the 20,000-character cap", () => {
    expect(() => buildStreamRequest({ text: "a".repeat(20000) })).not.toThrow();
  });

  it("rejects input over the 20,000-character cap", () => {
    expect(() => buildStreamRequest({ text: "a".repeat(20001) })).toThrow(
      StreamValidationError,
    );
  });
});

describe("request shape (docs)", () => {
  it("emits the documented body", () => {
    expect(buildStreamRequest({ text: "Hello call" })).toEqual({
      input: "Hello call",
      voice_id: "geffen_32",
      model: "simba-3.2",
      output_format: "ulaw_8000",
    });
  });
});

describe("twiml", () => {
  it("connects a call to the Media Streams WebSocket", () => {
    const xml = twiml("example.com");
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<Connect>");
    expect(xml).toContain('<Stream url="wss://example.com/stream" />');
    expect(xml).toContain("</Connect>");
    expect(xml).toContain("</Response>");
  });
});
