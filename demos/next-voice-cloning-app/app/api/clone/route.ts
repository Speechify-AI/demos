import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

// Pin the API version the verified-consent flow ships on (also the SDK default).
const client = new SpeechifyClient({
  token: process.env.SPEECHIFY_API_KEY,
  version: "2026-09-13",
});

// Leg 2 of cloning: the sample, the consent recording, and the challenge id that
// ties them together. The recording must be the same speaker as the sample.
export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const sample = form.get("sample");
  const consentRecording = form.get("consentRecording");
  const consentChallengeId = form.get("consentChallengeId");

  if (
    !(sample instanceof File) ||
    !(consentRecording instanceof File) ||
    typeof consentChallengeId !== "string"
  ) {
    return NextResponse.json(
      { error: "sample (file), consentRecording (file) and consentChallengeId are all required" },
      { status: 400 },
    );
  }

  try {
    const voice = await client.voices.create({
      name: `clone-${Date.now()}`,
      gender: "male",
      sample,
      consent_challenge_id: consentChallengeId,
      consent_recording: consentRecording,
    });
    return NextResponse.json({ voiceId: voice.id, displayName: voice.display_name });
  } catch (err) {
    if (err instanceof SpeechifyError && err.statusCode === 402) {
      return NextResponse.json(
        { error: "Voice cloning isn't included in your current Speechify plan." },
        { status: 402 },
      );
    }
    // Consent failures (bad/expired challenge, recording doesn't match the
    // phrase or the sample's speaker) come back as 4xx with a `consent_*` code.
    if (err instanceof SpeechifyError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      const body = err.body as { error?: string; code?: string } | undefined;
      return NextResponse.json(
        { error: body?.error ?? "Consent verification failed — start over with a new phrase." },
        { status: err.statusCode },
      );
    }
    throw err;
  }
}
