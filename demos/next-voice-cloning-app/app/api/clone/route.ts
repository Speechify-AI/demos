import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function POST(req: Request) {
  const form = await req.formData();
  const sample = form.get("sample");
  const fullName = form.get("fullName");
  const email = form.get("email");

  if (!(sample instanceof File) || typeof fullName !== "string" || typeof email !== "string") {
    return NextResponse.json(
      { error: "sample (file), fullName and email are all required" },
      { status: 400 },
    );
  }

  try {
    const voice = await client.voices.create({
      name: `clone-${Date.now()}`,
      gender: "male",
      sample,
      consent: JSON.stringify({ fullName, email }),
    });
    return NextResponse.json({ voiceId: voice.id, displayName: voice.display_name });
  } catch (err) {
    if (err instanceof SpeechifyError && err.statusCode === 402) {
      return NextResponse.json(
        { error: "Voice cloning isn't included in your current Speechify plan." },
        { status: 402 },
      );
    }
    throw err;
  }
}
