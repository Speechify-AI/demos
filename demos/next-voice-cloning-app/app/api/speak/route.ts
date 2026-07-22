import { NextResponse } from "next/server";
import { SpeechifyClient } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, voiceId } = await req.json();

  if (typeof text !== "string" || typeof voiceId !== "string") {
    return NextResponse.json({ error: "text and voiceId are required" }, { status: 400 });
  }

  const speech = await client.audio.speech({
    input: text,
    voice_id: voiceId,
    audio_format: "mp3",
    model: "simba-english",
  });

  return NextResponse.json({ audio: speech.audio_data });
}
