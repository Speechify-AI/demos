import { NextResponse } from "next/server";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const SPEECH_URL = "https://api.speechify.ai/v1/audio/speech";

// Keep the demo cheap and fast: cap how much of a long article we narrate.
const MAX_CHUNKS = 6;
const CHUNK_MIN = 500;
const CHUNK_MAX = 800;

// Naive readability: strip scripts/styles, pull the text out of block tags,
// collapse whitespace. A production version would use a real extractor
// (Readability, Mercury); this is deliberately dependency-free and good enough
// to demo. It is NOT a general-purpose scraper.
function extract(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decode(titleMatch?.[1]?.trim() ?? "Untitled");

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");

  // Prefer paragraph and heading text; fall back to stripped body.
  const blocks = [...body.matchAll(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 40);

  const text = (blocks.length ? blocks.join("\n\n") : decode(body.replace(/<[^>]+>/g, " ")))
    .replace(/[ \t]+/g, " ")
    .trim();

  return { title, text };
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Chunk on sentence boundaries, packing into ~500-800 char segments.
function chunk(text: string): string[] {
  const paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const para of paras) {
    if ((buf + " " + para).length <= CHUNK_MAX) {
      buf = buf ? `${buf}\n\n${para}` : para;
      continue;
    }
    if (buf.length >= CHUNK_MIN) flush();
    if (para.length <= CHUNK_MAX) {
      if (buf) flush();
      buf = para;
      continue;
    }
    // Paragraph too long: split on sentence boundaries.
    for (const sentence of para.split(/(?<=[.!?])\s+/)) {
      if ((buf + " " + sentence).length > CHUNK_MAX) flush();
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
  }
  flush();
  return out;
}

// Reject anything that isn't a public http(s) URL. Minimal SSRF guard; a
// production version would also resolve DNS and block private ranges.
function safeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return null;
  }
  return u;
}

async function synth(text: string): Promise<string> {
  const res = await fetch(SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHIFY_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      voice_id: "geffen_32",
      model: "simba-3.2",
      audio_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "synthesis failed"));
  const data = (await res.json()) as { audio_data?: string };
  return data.audio_data ?? "";
}

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { url } = (await req.json().catch(() => ({}))) as { url?: unknown };
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  const safe = safeUrl(url.trim());
  if (!safe) {
    return NextResponse.json({ error: "provide a public http(s) URL" }, { status: 400 });
  }

  let html: string;
  try {
    const page = await fetch(safe, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SpeechifyDemo/1.0)" },
      redirect: "follow",
    });
    if (!page.ok) {
      return NextResponse.json({ error: `fetch failed (${page.status})` }, { status: 502 });
    }
    html = await page.text();
  } catch {
    return NextResponse.json({ error: "could not fetch the page" }, { status: 502 });
  }

  const { title, text } = extract(html);
  if (text.length < 200) {
    return NextResponse.json(
      { error: "couldn't find enough readable text on that page" },
      { status: 422 },
    );
  }

  const parts = chunk(text).slice(0, MAX_CHUNKS);
  const chunks: { audio: string; text: string }[] = [];
  for (const part of parts) {
    chunks.push({ audio: await synth(part), text: part });
  }

  return NextResponse.json({
    title,
    truncated: chunk(text).length > MAX_CHUNKS,
    chunks,
  });
}
