import { NextResponse } from "next/server";
import { generateSpeech } from "ai";
import { speechify } from "../../lib/speechify-provider";
import { verifyTurnstile } from "../../lib/turnstile";
import { rateLimit } from "../../lib/rate-limit";

export const runtime = "nodejs";

// Matches the server-side cap on GetSpeechRequest.input: requests over this
// get rejected here instead of spending a call on a request Speechify would
// 400 anyway.
const MAX_TEXT_LENGTH = 2000;

// Turnstile proves a human solved a challenge once; it doesn't cap how many
// paid requests that same caller sends afterward. Bound it per-IP so passing
// Turnstile isn't a license to spend the demo's key at will.
const RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!rateLimit(req, RATE_LIMIT)) {
    return NextResponse.json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const { text, voiceId } = await req.json();

  if (typeof text !== "string" || typeof voiceId !== "string") {
    return NextResponse.json(
      { error: "text and voiceId are required" },
      { status: 400 },
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text must be ${MAX_TEXT_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  try {
    const result = await generateSpeech({
      model: speechify.speech("simba-3.2"),
      text,
      voice: voiceId,
    });

    return NextResponse.json({
      audio: result.audio.base64,
      mediaType: result.audio.mediaType,
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
    });
  } catch (err) {
    // doGenerate() throws a plain Error on any non-2xx from Speechify (bad
    // voice/model, rate limit, upstream 5xx). Uncaught, that crashes the
    // route with a bodyless 500 and the caller never learns why.
    console.error("generateSpeech() failed:", err);
    const message = err instanceof Error ? err.message : "Speech generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
