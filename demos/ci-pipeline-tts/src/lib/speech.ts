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

// The speech endpoint accepts up to 2,000 characters of input.
export const MAX_INPUT_CHARS = 2000;

// The recommended model for new English integrations and the docs' explicit
// "opt in" model (the API default is simba-3.0 when `model` is omitted).
export const DEFAULT_MODEL: SpeechModel = "simba-3.2";

// The request body the docs document for POST /v1/audio/speech (snake_case).
export interface SpeechRequest {
  input: string;
  voice_id: string;
  audio_format: SpeechAudioFormat;
  model: SpeechModel;
}

export interface BuildSpeechRequestOptions {
  text: string;
  voiceId: string;
  model?: SpeechModel;
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

export function assertAudioFormat(format: string): asserts format is SpeechAudioFormat {
  if (!(SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(format)) {
    throw new SpeechValidationError(
      `Unsupported audio_format "${format}". The docs allow only ${SUPPORTED_AUDIO_FORMATS.join(", ")}.`,
    );
  }
}

export function assertInputWithinLimit(text: string): void {
  if (text.length > MAX_INPUT_CHARS) {
    throw new SpeechValidationError(
      `Input is ${text.length} characters; the speech endpoint accepts at most ${MAX_INPUT_CHARS}.`,
    );
  }
}

// simba-3.2 serves a curated, English-only voice roster. Any other voice id is
// rejected by the API, so we reject it up front too.
export function assertVoiceForModel(voiceId: string, model: SpeechModel): void {
  if (model === "simba-3.2" && !(CURATED_VOICES_32 as readonly string[]).includes(voiceId)) {
    throw new SpeechValidationError(
      `simba-3.2 serves a curated voice roster only. Pick one of: ${CURATED_VOICES_32.join(", ")}.`,
    );
  }
}

// Build a documented POST /v1/audio/speech body from friendly options, running
// every guard the docs imply so a bad value fails locally before it costs a
// request. The result is passed straight to the SDK (`client.audio.speech`),
// which takes the same snake_case body.
export function buildSpeechRequest(options: BuildSpeechRequestOptions): SpeechRequest {
  const model = options.model ?? DEFAULT_MODEL;
  const audioFormat = options.audioFormat ?? "mp3";

  assertModelSupported(model);
  assertAudioFormat(audioFormat);
  assertInputWithinLimit(options.text);
  assertVoiceForModel(options.voiceId, model);

  if (!options.voiceId) {
    throw new SpeechValidationError("A voice_id is required.");
  }

  return {
    input: options.text,
    voice_id: options.voiceId,
    audio_format: audioFormat,
    model,
  };
}
