import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, voiceId } = await req.json();

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const speech = await client.audio.speech({
      input: text.slice(0, 2000),
      voice_id: typeof voiceId === "string" && voiceId ? voiceId : "geffen_32",
      audio_format: "mp3",
      model: "simba-3.2",
    });
    return NextResponse.json({ audio: speech.audio_data });
  } catch (err) {
    if (err instanceof SpeechifyError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 500 });
    }
    throw err;
  }
}
