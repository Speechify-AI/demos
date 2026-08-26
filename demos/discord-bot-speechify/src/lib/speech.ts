// Request building and validation for POST /v1/audio/speech.
//
// These constants and guards mirror the live API contract at
// https://docs.speechify.ai/build/api-reference/v1/audio/speech and are the
// source of truth the unit tests check the code against. Keep them in lockstep
// with the docs; the test suite fails loudly if the code drifts.

export const SPEECH_ENDPOINT = "https://api.speechify.ai/v1/audio/speech";

// `model` enum, per the docs. Simba 1.6 (`simba-english` / `simba-multilingual`)
// are retired from API version 2026-09-21 and switched off everywhere on
// 2026-11-21, so they are intentionally NOT offered here.
export const SUPPORTED_MODELS = ["simba-3.0", "simba-3.2"] as const;
export type SpeechModel = (typeof SUPPORTED_MODELS)[number];

// `audio_format` enum, per the docs.
export const SUPPORTED_AUDIO_FORMATS = ["wav", "mp3", "ogg", "aac", "pcm"] as const;
export type SpeechAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number];

// simba-3.2 is English-only and serves a curated voice roster. The docs list
// these eight as the curated set to pair with `simba-3.2`.
export const CURATED_VOICES_32 = [
  "beatrice_32",
  "dominic_32",
  "edmund_32",
  "geffen_32",
  "harper_32",
  "hugh_32",
  "imogen_32",
  "wyatt_32",
] as const;

// The speech endpoint accepts up to 2,000 characters of input
// (https://docs.speechify.ai/docs/api-limits).
export const MAX_INPUT_CHARS = 2000;

// The recommended defaults: the docs' canonical English pairing
// (voice geffen_32 on model simba-3.2).
export const DEFAULT_MODEL: SpeechModel = "simba-3.2";
export const DEFAULT_VOICE = "geffen_32";

// The request body the docs document for POST /v1/audio/speech (snake_case).
export interface SpeechRequest {
  input: string;
  voice_id: string;
  audio_format: SpeechAudioFormat;
  model: SpeechModel;
}

export interface BuildSpeechRequestOptions {
  text: string;
  voiceId?: string;
  model?: string;
  audioFormat?: SpeechAudioFormat;
}

export class SpeechValidationError extends Error {}

export function assertModelSupported(model: string): asserts model is SpeechModel {
  if (!(SUPPORTED_MODELS as readonly string[]).includes(model)) {
    throw new SpeechValidationError(
      `Unsupported model "${model}". The docs allow only ${SUPPORTED_MODELS.join(", ")}.`,
    );
  }
}

export function assertAudioFormatSupported(format: string): asserts format is SpeechAudioFormat {
  if (!(SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(format)) {
    throw new SpeechValidationError(
      `Unsupported audio_format "${format}". The docs allow only ${SUPPORTED_AUDIO_FORMATS.join(", ")}.`,
    );
  }
}

export function assertVoiceSupported(voiceId: string): void {
  if (!(CURATED_VOICES_32 as readonly string[]).includes(voiceId)) {
    throw new SpeechValidationError(
      `Unsupported voice_id "${voiceId}" for simba-3.2. The docs' curated roster is ${CURATED_VOICES_32.join(", ")}.`,
    );
  }
}

// Builds and validates the exact request body documented for
// POST /v1/audio/speech. Throws SpeechValidationError on anything the API
// would reject, so a misconfigured bot fails loudly before spending a call.
export function buildSpeechRequest(opts: BuildSpeechRequestOptions): SpeechRequest {
  const text = (opts.text ?? "").trim();
  if (!text) {
    throw new SpeechValidationError("input is required");
  }
  if (text.length > MAX_INPUT_CHARS) {
    throw new SpeechValidationError(
      `input is ${text.length} characters; the speech endpoint caps input at ${MAX_INPUT_CHARS}`,
    );
  }

  const model = opts.model ?? DEFAULT_MODEL;
  assertModelSupported(model);

  const voiceId = opts.voiceId ?? DEFAULT_VOICE;
  assertVoiceSupported(voiceId);

  const audioFormat = opts.audioFormat ?? "mp3";
  assertAudioFormatSupported(audioFormat);

  return {
    input: text,
    voice_id: voiceId,
    audio_format: audioFormat,
    model,
  };
}
