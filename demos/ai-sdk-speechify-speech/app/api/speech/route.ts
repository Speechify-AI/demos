import { NextResponse } from "next/server";
import { generateSpeech } from "ai";
import { speechify } from "../../lib/speechify-provider";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text, voiceId } = await req.json();

  if (typeof text !== "string" || typeof voiceId !== "string") {
    return NextResponse.json(
      { error: "text and voiceId are required" },
      { status: 400 },
    );
  }

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
}
