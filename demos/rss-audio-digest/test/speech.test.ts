import { describe, it, expect } from "vitest";
import {
  SPEECH_ENDPOINT,
  SUPPORTED_MODELS,
  SUPPORTED_AUDIO_FORMATS,
  CURATED_VOICES_32,
  MAX_INPUT_CHARS,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  buildSpeechRequest,
  SpeechValidationError,
} from "../src/lib/speech.ts";

// These tests pin the code to the live API contract in
// https://docs.speechify.ai/build/api-reference/v1/audio/speech (limits:
// https://docs.speechify.ai/docs/api-limits). If a documented value changes
// (a model is retired, a format added), the constants here must move with it
// and these assertions are the tripwire.

describe("POST /v1/audio/speech endpoint (docs)", () => {
  it("points at the documented endpoint", () => {
    expect(SPEECH_ENDPOINT).toBe("https://api.speechify.ai/v1/audio/speech");
  });
});

describe("model enum (docs: simba-3.0, simba-3.2)", () => {
  it("offers exactly the two current Simba 3 models", () => {
    expect([...SUPPORTED_MODELS].sort()).toEqual(["simba-3.0", "simba-3.2"]);
  });

  it("excludes the retired Simba 1.6 models", () => {
    for (const retired of ["simba-english", "simba-multilingual"]) {
      expect(SUPPORTED_MODELS).not.toContain(retired);
    }
  });

  it("defaults to the docs' recommended English model simba-3.2", () => {
    expect(DEFAULT_MODEL).toBe("simba-3.2");
  });

  it("throws on the retired model", () => {
    expect(() =>
      buildSpeechRequest({ text: "hi", voiceId: "geffen_32", model: "simba-english" }),
    ).toThrow(SpeechValidationError);
  });
});

describe("audio_format enum (docs: wav, mp3, ogg, aac, pcm)", () => {
  it("covers the documented set", () => {
    expect([...SUPPORTED_AUDIO_FORMATS].sort()).toEqual(["aac", "mp3", "ogg", "pcm", "wav"]);
  });

  it("throws on an audio_format the API does not accept", () => {
    expect(() =>
      buildSpeechRequest({ text: "hi", voiceId: "geffen_32", audioFormat: "flac" as never }),
    ).toThrow(SpeechValidationError);
  });
});

describe("simba-3.2 curated voices (docs)", () => {
  it("accepts every documented curated voice", () => {
    for (const voice of CURATED_VOICES_32) {
      expect(() => buildSpeechRequest({ text: "hi", voiceId: voice })).not.toThrow();
    }
  });

  it("rejects the retired Simba 1.6-era voice", () => {
    expect(() => buildSpeechRequest({ text: "hi", voiceId: "george" })).toThrow(
      SpeechValidationError,
    );
  });

  it("defaults to the docs' example voice geffen_32", () => {
    expect(DEFAULT_VOICE).toBe("geffen_32");
  });
});

describe("input rules (docs)", () => {
  it("rejects empty input", () => {
    expect(() => buildSpeechRequest({ text: "   " })).toThrow(SpeechValidationError);
  });

  it("accepts input at the 2,000-character cap", () => {
    expect(() => buildSpeechRequest({ text: "a".repeat(MAX_INPUT_CHARS) })).not.toThrow();
  });

  it("rejects input over the 2,000-character cap", () => {
    expect(() => buildSpeechRequest({ text: "a".repeat(MAX_INPUT_CHARS + 1) })).toThrow(
      SpeechValidationError,
    );
  });
});

describe("request shape (docs)", () => {
  it("emits the documented snake_case body", () => {
    const request = buildSpeechRequest({
      text: "Hello feed",
      voiceId: "geffen_32",
      model: "simba-3.2",
      audioFormat: "mp3",
    });
    expect(request).toEqual({
      input: "Hello feed",
      voice_id: "geffen_32",
      audio_format: "mp3",
      model: "simba-3.2",
    });
  });
});
