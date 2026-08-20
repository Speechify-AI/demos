import { verifyTurnstile } from "../../lib/turnstile";

// The whole demo is this one file: a serverless EDGE function that streams
// Speechify TTS audio straight back to the browser. No SDK (it is Node-only),
// no buffering — the upstream MP3 body is piped through as it arrives, so the
// client can start playing before synthesis finishes.
export const runtime = "edge";

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
