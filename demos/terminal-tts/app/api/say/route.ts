import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import type { Speechify } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

type Model = Speechify.GetSpeechRequest.Model;

const DEFAULT_VOICE = "geffen_32";
const DEFAULT_MODEL: Model = "simba-3.2";
const MAX_CHARS = 2000;
const MODELS = new Set<Model>([
  "simba-3.2",
  "simba-3.0",
  "simba-english",
  "simba-multilingual",
]);

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, voiceId, model } = await req.json().catch(() => ({}));

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `text must be ${MAX_CHARS} characters or fewer` },
      { status: 400 },
    );
  }

  const voice_id = typeof voiceId === "string" && voiceId ? voiceId : DEFAULT_VOICE;
  const chosenModel: Model =
    typeof model === "string" && MODELS.has(model as Model)
      ? (model as Model)
      : DEFAULT_MODEL;

  try {
    const speech = await client.audio.speech({
      input: text,
      voice_id,
      audio_format: "mp3",
      model: chosenModel,
    });
    return NextResponse.json({
      audio: speech.audio_data,
      voiceId: voice_id,
      model: chosenModel,
      billableCharacters: speech.billable_characters_count,
    });
  } catch (err) {
    if (err instanceof SpeechifyError) {
      return NextResponse.json(
        { error: err.message || "Speechify request failed" },
        { status: err.statusCode ?? 502 },
      );
    }
    return NextResponse.json(
      { error: "Synthesis failed" },
      { status: 500 },
    );
  }
}
