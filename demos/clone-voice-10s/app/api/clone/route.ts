import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const sample = form.get("sample");
  const fullName = form.get("fullName");
  const email = form.get("email");
  const gender = form.get("gender");
  const consent = form.get("consent");

  if (
    !(sample instanceof File) ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    typeof email !== "string" ||
    !email.trim()
  ) {
    return NextResponse.json(
      { error: "sample (file), fullName and email are all required" },
      { status: 400 },
    );
  }

  // Consent is a first-class gate: no clone without it. The checkbox in the UI
  // sends consent=true; we refuse to call the API otherwise.
  if (consent !== "true") {
    return NextResponse.json(
      { error: "You must confirm you have the speaker's consent to clone this voice." },
      { status: 400 },
    );
  }

  const voiceGender = gender === "female" ? "female" : "male";

  try {
    const voice = await client.voices.create({
      name: `clone-10s-${Date.now()}`,
      gender: voiceGender,
      sample,
      // The consenting person's identity is recorded with the clone.
      consent: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
    });
    return NextResponse.json({ voiceId: voice.id, displayName: voice.display_name });
  } catch (err) {
    if (err instanceof SpeechifyError && err.statusCode === 402) {
      return NextResponse.json(
        {
          error:
            "Voice cloning isn't included in your current Speechify plan. Everything else in this demo still shows the flow.",
        },
        { status: 402 },
      );
    }
    throw err;
  }
}
