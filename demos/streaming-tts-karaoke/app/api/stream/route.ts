import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";
// Don't let the platform buffer the SSE — we want events to reach the browser
// the instant Speechify emits them.
export const dynamic = "force-dynamic";

const UPSTREAM = "https://api.speechify.ai/v1/audio/stream/with-timestamps";

// Proxies the Speechify streaming-with-timestamps endpoint. It is Server-Sent
// Events: each `speech.chunk` carries a run of base64 audio and/or word
// `speech_marks` (absolute-ms times + char offsets into the input). We pass the
// stream straight through so the browser sees marks and audio arrive live — the
// API key never leaves the server.
export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return new Response("Forbidden", { status: 403 });
  }

  const key = process.env.SPEECHIFY_API_KEY;
  if (!key) {
    return new Response("SPEECHIFY_API_KEY is not set on the server.", { status: 503 });
  }

  const { input } = (await req.json().catch(() => ({}))) as { input?: unknown };
  if (typeof input !== "string" || input.trim() === "") {
    return new Response("`input` text is required", { status: 400 });
  }

  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "audio/mpeg",
      // Speech marks are produced by streaming-native models only.
      "Speechify-Version": "2026-09-13",
    },
    body: JSON.stringify({
      input: input.slice(0, 3000),
      voice_id: "geffen_32",
      model: "simba-3.2",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(detail || "Speechify request failed", {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Codec of the base64 audio carried in each event (mirrors upstream).
      "speechify-audio-content-type":
        upstream.headers.get("speechify-audio-content-type") ?? "audio/mpeg",
    },
  });
}
