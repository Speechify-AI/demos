import { NextResponse } from "next/server";
import { findLanguage } from "../../lib/languages";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const MODEL = "simba-3.0";

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code } = await req.json();
  const language = typeof code === "string" ? findLanguage(code) : undefined;
  if (!language) {
    return NextResponse.json({ error: "Unknown language code" }, { status: 400 });
  }

  const apiKey = process.env.SPEECHIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing SPEECHIFY_API_KEY" }, { status: 500 });
  }

  const res = await fetch("https://api.speechify.ai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: language.text,
      voice_id: language.voiceId,
      audio_format: "mp3",
      model: MODEL,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Speechify responded ${res.status}: ${await res.text()}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    audio_data: string;
    audio_format: string;
    billable_characters_count?: number;
  };

  return NextResponse.json({
    audio: data.audio_data,
    mediaType: "audio/mpeg",
    model: MODEL,
    voiceId: language.voiceId,
    voiceName: language.voiceName,
    locale: language.code,
    text: language.text,
    billableCharactersCount: data.billable_characters_count ?? null,
  });
}
