import { NextResponse } from "next/server";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

const MODEL = "simba-3.2";
// Cap total input so the demo stays cheap. Noted in the UI + README.
const MAX_INPUT_CHARS = 8000;
// Target chunk size. Sentence-boundary splits keep chunks in this window so
// each TTS request is small enough to synthesize quickly and stitch cleanly.
const MAX_CHUNK_CHARS = 800;

// Voices that support simba-3.2.
const SIMBA_VOICES = new Set([
  "geffen_32",
  "harper_32",
  "dominic_32",
  "beatrice_32",
  "wyatt_32",
  "edmund_32",
  "hugh_32",
  "imogen_32",
]);

// Split AFTER sentence punctuation on whitespace only. The lookbehind keeps the
// punctuation attached to the sentence (so "Mr. Smith" is not torn apart on the
// following whitespace — it only breaks after . ! ? that end a sentence).
function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Pack a single paragraph's sentences into <= max-char chunks.
function chunkParagraph(paragraph: string, max: number): string[] {
  const chunks: string[] = [];
  let buf = "";
  for (const sentence of splitSentences(paragraph)) {
    if (!buf) {
      buf = sentence;
    } else if (`${buf} ${sentence}`.length <= max) {
      buf += ` ${sentence}`;
    } else {
      chunks.push(buf);
      buf = sentence;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

type VoicedChunk = { text: string; voice: string };

// Single-voice: pack whole paragraphs together up to the cap, falling back to
// sentence splits only when a paragraph is bigger than the cap on its own.
function chunkSingleVoice(text: string, voice: string): VoicedChunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buf = "";
  for (const para of paragraphs) {
    if (para.length > MAX_CHUNK_CHARS) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      for (const c of chunkParagraph(para, MAX_CHUNK_CHARS)) out.push(c);
    } else if (!buf) {
      buf = para;
    } else if (`${buf}\n\n${para}`.length <= MAX_CHUNK_CHARS) {
      buf += `\n\n${para}`;
    } else {
      out.push(buf);
      buf = para;
    }
  }
  if (buf) out.push(buf);
  return out.map((t) => ({ text: t, voice }));
}

// Two-voice: never merge across paragraphs. Alternate host/guest per paragraph
// so the reading feels like a back-and-forth between two speakers.
function chunkTwoVoice(
  text: string,
  hostVoice: string,
  guestVoice: string,
): VoicedChunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: VoicedChunk[] = [];
  paragraphs.forEach((para, i) => {
    const voice = i % 2 === 0 ? hostVoice : guestVoice;
    for (const c of chunkParagraph(para, MAX_CHUNK_CHARS)) {
      out.push({ text: c, voice });
    }
  });
  return out;
}

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    text,
    hostVoice = "geffen_32",
    guestVoice,
    intro = true,
  } = (body ?? {}) as {
    text?: unknown;
    hostVoice?: unknown;
    guestVoice?: unknown;
    intro?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      {
        error: `Article is too long. This demo caps input at ${MAX_INPUT_CHARS} characters (got ${text.length}).`,
      },
      { status: 400 },
    );
  }
  if (typeof hostVoice !== "string" || !SIMBA_VOICES.has(hostVoice)) {
    return NextResponse.json(
      { error: "hostVoice must be a valid simba-3.2 voice" },
      { status: 400 },
    );
  }
  const guest =
    typeof guestVoice === "string" && guestVoice ? guestVoice : null;
  if (guest && !SIMBA_VOICES.has(guest)) {
    return NextResponse.json(
      { error: "guestVoice must be a valid simba-3.2 voice" },
      { status: 400 },
    );
  }

  // Build the ordered, voiced chunk list.
  const voiced: VoicedChunk[] = guest
    ? chunkTwoVoice(text.trim(), hostVoice, guest)
    : chunkSingleVoice(text.trim(), hostVoice);

  // Optionally prepend a short intro line, always in the host voice, so it
  // opens like an episode.
  if (intro) {
    voiced.unshift({
      text: "You're listening to an episode generated with the Speechify API. Here's today's story.",
      voice: hostVoice,
    });
  }

  if (voiced.length === 0) {
    return NextResponse.json(
      { error: "Nothing to synthesize" },
      { status: 400 },
    );
  }

  try {
    // Synthesize each chunk. Kept sequential to preserve order and stay gentle
    // on rate limits — a real pipeline could bound-concurrency this.
    const chunks: { audio: string; text: string }[] = [];
    for (const c of voiced) {
      const speech = await client.audio.speech({
        input: c.text,
        voice_id: c.voice,
        audio_format: "mp3",
        model: MODEL,
      });
      chunks.push({ audio: speech.audio_data, text: c.text });
    }
    return NextResponse.json({ chunks });
  } catch (err) {
    if (err instanceof SpeechifyError) {
      return NextResponse.json(
        { error: err.message || "Speechify API error" },
        { status: err.statusCode ?? 502 },
      );
    }
    return NextResponse.json(
      { error: "Failed to synthesize episode" },
      { status: 500 },
    );
  }
}
