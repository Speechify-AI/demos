// A minimal Speechify provider for the AI SDK's speech interface.
//
// The AI SDK accepts any object implementing SpeechModelV4: a specification
// version, provider/model identifiers, and one doGenerate() call. This file
// maps that interface onto Speechify's POST /v1/audio/speech endpoint with
// plain fetch. No SDK dependency, around a hundred lines.
import type {
  SharedV4Warning,
  SpeechModelV4,
  SpeechModelV4CallOptions,
  SpeechModelV4Result,
} from "@ai-sdk/provider";

const DEFAULT_BASE_URL = "https://api.speechify.ai";
const DEFAULT_VOICE = "harper_32";
// Formats POST /v1/audio/speech accepts via audio_format.
const SUPPORTED_FORMATS = ["mp3", "ogg", "aac", "wav"];

interface SpeechifySpeechResponse {
  audio_data: string;
  audio_format: string;
  billable_characters_count?: number;
  speech_marks?: unknown;
}

export interface SpeechifyProviderSettings {
  /** Defaults to the SPEECHIFY_API_KEY environment variable. */
  apiKey?: string;
  /** Defaults to https://api.speechify.ai */
  baseURL?: string;
}

export function createSpeechify(settings: SpeechifyProviderSettings = {}) {
  const baseURL = settings.baseURL ?? DEFAULT_BASE_URL;

  function speech(modelId: string): SpeechModelV4 {
    return {
      specificationVersion: "v4",
      provider: "speechify",
      modelId,

      async doGenerate(
        options: SpeechModelV4CallOptions,
      ): Promise<SpeechModelV4Result> {
        const apiKey = settings.apiKey ?? process.env.SPEECHIFY_API_KEY;
        if (!apiKey) {
          throw new Error(
            "Missing Speechify API key. Set SPEECHIFY_API_KEY or pass apiKey to createSpeechify().",
          );
        }

        const { text, voice, outputFormat, instructions, speed, language } =
          options;
        const warnings: SharedV4Warning[] = [];

        let audioFormat = outputFormat ?? "mp3";
        if (!SUPPORTED_FORMATS.includes(audioFormat)) {
          warnings.push({
            type: "unsupported",
            feature: `outputFormat: ${audioFormat}`,
            details: "Falling back to mp3. Supported: mp3, ogg, aac, wav.",
          });
          audioFormat = "mp3";
        }
        if (instructions) {
          warnings.push({
            type: "unsupported",
            feature: "instructions",
            details:
              "Speechify controls delivery with SSML in the input text, not a free-text instruction field.",
          });
        }
        if (speed != null) {
          warnings.push({
            type: "unsupported",
            feature: "speed",
            details: "Use an SSML prosody rate in the input text instead.",
          });
        }
        if (language) {
          warnings.push({
            type: "unsupported",
            feature: "language",
            details:
              "Language follows the model: use simba-multilingual for non-English input.",
          });
        }

        const body = {
          input: text,
          voice_id: voice ?? DEFAULT_VOICE,
          audio_format: audioFormat,
          model: modelId,
        };

        const res = await fetch(`${baseURL}/v1/audio/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...Object.fromEntries(
              Object.entries(options.headers ?? {}).filter(
                (entry): entry is [string, string] => entry[1] != null,
              ),
            ),
          },
          body: JSON.stringify(body),
          signal: options.abortSignal,
        });

        if (!res.ok) {
          throw new Error(
            `Speechify POST /v1/audio/speech responded ${res.status}: ${await res.text()}`,
          );
        }

        const data = (await res.json()) as SpeechifySpeechResponse;

        return {
          // The endpoint returns base64; the spec says to pass audio through
          // in whatever encoding the API used.
          audio: data.audio_data,
          warnings,
          request: { body },
          response: {
            timestamp: new Date(),
            modelId,
            headers: Object.fromEntries(res.headers.entries()),
          },
          providerMetadata: {
            speechify: JSON.parse(
              JSON.stringify({
                audioFormat: data.audio_format,
                billableCharactersCount:
                  data.billable_characters_count ?? null,
                speechMarks: data.speech_marks ?? null,
              }),
            ),
          },
        };
      },
    };
  }

  return { speech };
}

/** Default provider instance reading SPEECHIFY_API_KEY from the environment. */
export const speechify = createSpeechify();
