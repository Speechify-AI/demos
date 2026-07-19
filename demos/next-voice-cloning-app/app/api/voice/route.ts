import { NextResponse } from "next/server";
import { SpeechifyClient } from "@speechify/api";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const voiceId = searchParams.get("id");

  if (!voiceId) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  await client.voices.delete({ voice_id: voiceId });
  return NextResponse.json({ deleted: voiceId });
}
