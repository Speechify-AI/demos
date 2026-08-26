// The Speechify side of the call: request building for POST /v1/audio/stream.
//
// Constants mirror the live API contract at
// https://docs.speechify.ai/build/api-reference/v1/audio/stream and the tests
// pin them. Keep them in lockstep with the docs.

export const SPEECH_STREAM_URL = "https://api.speechify.ai/v1/audio/stream";

// `model` enum, per the docs. Simba 1.6 (`simba-english` / `simba-multilingual`)
// are retired from API version 2026-09-21, so they are intentionally NOT
// offered here.
export const SUPPORTED_MODELS = ["simba-3.0", "simba-3.2"];

// The docs' canonical English pairing: geffen_32 on simba-3.2.
export const DEFAULT_MODEL = "simba-3.2";
export const DEFAULT_VOICE = "geffen_32";

// Twilio's native format: 8 kHz mu-law, 20 ms frames — no transcoding.
export const TWILIO_OUTPUT_FORMAT = "ulaw_8000";

export class StreamValidationError extends Error {}

// Builds and validates the exact request body documented for
// POST /v1/audio/stream. The Accept header (`audio/basic`) mirrors what the
// docs say a u-law stream response returns.
export function buildStreamRequest({ text, voiceId = DEFAULT_VOICE, model = DEFAULT_MODEL }) {
  const input = (text ?? "").trim();
  if (!input) throw new StreamValidationError("input is required");
  if (input.length > 20000) {
    throw new StreamValidationError(
      `input is ${input.length} characters; the stream endpoint caps input at 20,000`,
    );
  }
  if (!SUPPORTED_MODELS.includes(model)) {
    throw new StreamValidationError(
      `Unsupported model "${model}". The docs allow only ${SUPPORTED_MODELS.join(", ")}.`,
    );
  }
  return {
    input,
    voice_id: voiceId,
    model,
    output_format: TWILIO_OUTPUT_FORMAT,
  };
}

export const STREAM_ACCEPT_HEADER = "audio/basic";
