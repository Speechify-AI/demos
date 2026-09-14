import { describe, it, expect } from "vitest";
import {
  SPEECH_ENDPOINT,
  SUPPORTED_MODELS,
  SUPPORTED_AUDIO_FORMATS,
  CURATED_VOICES_32,
  MAX_INPUT_CHARS,
  DEFAULT_MODEL,
  buildSpeechRequest,
  SpeechValidationError,
} from "../src/lib/speech.ts";

// These tests pin the code to the live API contract in
// https://docs.speechify.ai/build/api-reference/v1/audio/speech.
// If a documented value changes (a model is retired, a format added), the
// constants here must move with it and these assertions are the tripwire.

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

  it("throws on an unknown model", () => {
    expect(() =>
      buildSpeechRequest({ text: "hi", voiceId: "geffen_32", model: "simba-2.0" as never }),
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
  it("accepts a documented curated voice", () => {
    for (const voice of CURATED_VOICES_32) {
      const req = buildSpeechRequest({ text: "hi", voiceId: voice, model: "simba-3.2" });
      expect(req.voice_id).toBe(voice);
    }
  });

  it("rejects a voice outside the curated roster for simba-3.2", () => {
    expect(() =>
      buildSpeechRequest({ text: "hi", voiceId: "someone_99", model: "simba-3.2" }),
    ).toThrow(SpeechValidationError);
  });

  it("allows any voice id on simba-3.0 (the full catalog)", () => {
    expect(() =>
      buildSpeechRequest({ text: "hi", voiceId: "someone_99", model: "simba-3.0" }),
    ).not.toThrow();
  });
});

describe("input length limit (docs: up to 2,000 characters)", () => {
  it("accepts input at the limit", () => {
    const text = "a".repeat(MAX_INPUT_CHARS);
    expect(() => buildSpeechRequest({ text, voiceId: "geffen_32" })).not.toThrow();
  });

  it("rejects input over the limit", () => {
    const text = "a".repeat(MAX_INPUT_CHARS + 1);
    expect(() => buildSpeechRequest({ text, voiceId: "geffen_32" })).toThrow(SpeechValidationError);
  });
});

describe("request body shape (docs snake_case body)", () => {
  it("emits exactly the documented fields", () => {
    const req = buildSpeechRequest({
      text: "Build passed.",
      voiceId: "geffen_32",
      model: "simba-3.2",
      audioFormat: "mp3",
    });
    expect(Object.keys(req).sort()).toEqual(["audio_format", "input", "model", "voice_id"]);
    expect(req).toEqual({
      input: "Build passed.",
      voice_id: "geffen_32",
      audio_format: "mp3",
      model: "simba-3.2",
    });
  });

  it("defaults audio_format to mp3", () => {
    const req = buildSpeechRequest({ text: "hi", voiceId: "geffen_32" });
    expect(req.audio_format).toBe("mp3");
  });

  it("requires a voice_id", () => {
    expect(() => buildSpeechRequest({ text: "hi", voiceId: "" })).toThrow(SpeechValidationError);
  });
});
