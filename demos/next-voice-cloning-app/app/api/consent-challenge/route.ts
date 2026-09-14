import { NextResponse } from "next/server";
import { SpeechifyClient } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

// Pin the API version the verified-consent flow ships on (also the SDK default).
const client = new SpeechifyClient({
  token: process.env.SPEECHIFY_API_KEY,
  version: "2026-09-13",
});

// Leg 1 of cloning: mint a consent challenge. Returns a `phrase` the speaker
// must read aloud and an `id` that ties their recording to this consent on the
// create. The id is opaque and single-use, so it's safe to hand back to the
// client and post again with the recording.
export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fullName } = await req.json();
  if (typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  const challenge = await client.voices.consentChallenges.create({ full_name: fullName });
  return NextResponse.json({
    challengeId: challenge.id,
    phrase: challenge.phrase,
    expiresAt: challenge.expires_at,
  });
}
