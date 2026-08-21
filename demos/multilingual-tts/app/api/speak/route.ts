import { NextResponse } from "next/server";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

// The whole feature is one field: `language`. We call the REST speech endpoint
// directly (rather than the Node SDK) so the `language` parameter passes
// through verbatim and the demo stays dependency-light. `simba-3.0` is the
// multilingual, streaming-native model; each language uses a voice native to
// that locale (see app/page.tsx). Omit `language` and the model infers it from
// the voice's own locale, but we send it to show the parameter doing the work.
const SPEECH_URL = "https://api.speechify.ai/v1/audio/speech";

// Locales this demo wires up, kept in sync with the picker in app/page.tsx.
const ALLOWED_LANGUAGES = new Set([
  "en-US",
  "de-DE",
  "es-MX",
  "fr-FR",
  "it-IT",
  "pt-BR",
]);

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, voiceId, language } = (await req.json().catch(() => ({}))) as {
    text?: unknown;
    voiceId?: unknown;
    language?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (typeof voiceId !== "string" || !voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }
  if (typeof language !== "string" || !ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json(
      { error: "unsupported language" },
      { status: 400 },
    );
  }

  const upstream = await fetch(SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHIFY_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      input: text.slice(0, 2000),
      voice_id: voiceId,
      model: "simba-3.0",
      audio_format: "mp3",
      language,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "Speechify request failed" },
      { status: upstream.status || 502 },
    );
  }

  const data = (await upstream.json()) as { audio_data?: string };
  return NextResponse.json({ audio: data.audio_data });
}
