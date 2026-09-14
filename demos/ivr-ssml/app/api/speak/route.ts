import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

// simba-3.2 is the latest streaming-native model; geffen_32 is one of its
// registered voices. Both plain text and SSML go in on the same `input` field.
const MODEL = "simba-3.2";
const VOICE_ID = "geffen_32";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = (body as { input?: unknown }).input;
  if (typeof input !== "string" || input.trim().length === 0) {
    return NextResponse.json(
      { error: "`input` is required (plain text or SSML)." },
      { status: 400 },
    );
  }

  try {
    const speech = await client.audio.speech({
      input,
      voice_id: VOICE_ID,
      audio_format: "mp3",
      model: MODEL,
    });

    return NextResponse.json({
      audio: speech.audio_data,
      billableCharactersCount: speech.billable_characters_count ?? null,
    });
  } catch (err) {
    if (err instanceof SpeechifyError) {
      // Malformed SSML comes back as a 4xx from the API — surface it so the
      // user can fix their markup instead of getting a generic 500.
      return NextResponse.json(
        { error: err.message || "Speechify request failed." },
        { status: err.statusCode ?? 502 },
      );
    }
    throw err;
  }
}
