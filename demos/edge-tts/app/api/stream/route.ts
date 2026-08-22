import { verifyTurnstile } from "../../lib/turnstile";

// The whole demo is this one file: a serverless function that streams Speechify
// TTS audio straight back to the browser. No SDK, no buffering — the upstream
// MP3 body is piped through as it arrives, so the client can start playing
// before synthesis finishes.
//
// Runtime note: this deploys under demos.speechify.ai, which is one Vercel
// project composed of many Services, and Services don't support the Edge
// runtime. So it runs as a Node serverless function — which also streams the
// response body. The exact same one file runs on `export const runtime = "edge"`
// in a standalone project; flip the line below if you deploy it on its own.
export const runtime = "nodejs";

const SPEECHIFY_STREAM_URL = "https://api.speechify.ai/v1/audio/stream";

export async function POST(req: Request) {
  // Abuse gate. Fails open locally when TURNSTILE_SECRET_KEY is unset.
  if (!(await verifyTurnstile(req))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { input } = (await req.json().catch(() => ({}))) as {
    input?: unknown;
  };
  if (typeof input !== "string" || input.trim() === "") {
    return new Response("`input` text is required", { status: 400 });
  }

  const upstream = await fetch(SPEECHIFY_STREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHIFY_API_KEY}`,
      "content-type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      input,
      voice_id: "geffen_32",
      model: "simba-3.2",
      audio_format: "mp3",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(detail || "Speechify request failed", {
      status: upstream.status || 502,
    });
  }

  // Pipe the streamed audio straight to the client.
  return new Response(upstream.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
