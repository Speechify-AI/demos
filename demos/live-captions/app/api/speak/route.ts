import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

// One speech mark per word: when it starts and ends in the audio, in
// milliseconds, plus the word itself. This is what drives the live captions.
type SpeechMark = {
  start_time: number;
  end_time: number;
  value: string;
};

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text } = await req.json();

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const speech = await client.audio.speech({
      input: text,
      voice_id: "geffen_32",
      audio_format: "mp3",
      model: "simba-3.2",
    });

    // chunks carry start_time / end_time (ms) + value for every word. Ship them
    // to the client so it can highlight the current word as the audio plays.
    const speechMarks: SpeechMark[] = (speech.speech_marks?.chunks ?? []).map(
      (c) => ({
        start_time: c.start_time ?? 0,
        end_time: c.end_time ?? 0,
        value: c.value ?? "",
      }),
    );

    return NextResponse.json({ audio: speech.audio_data, speechMarks });
  } catch (err) {
    if (err instanceof SpeechifyError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode ?? 500 },
      );
    }
    return NextResponse.json(
      { error: "Synthesis failed." },
      { status: 500 },
    );
  }
}
