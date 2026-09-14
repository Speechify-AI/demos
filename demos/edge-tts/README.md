# One-file serverless streaming TTS (Next.js)

A [Next.js](https://nextjs.org) demo whose whole backend is a **single serverless function** that streams Speechify text-to-speech audio straight to the browser. No SDK, no buffering, key held server-side. This is the shape you want for a TTS widget, a light integration, or a copy-paste starting point.

Pairs with the upcoming speechify.ai post "One-file serverless TTS on an edge function".

> **Runtime note.** This is hosted under `demos.speechify.ai`, which is one Vercel project composed of many [Services](https://vercel.com/docs/services), and Services don't support the Edge runtime. So it ships as a **Node serverless function** — which streams the response body just the same. The exact same one file runs on the Edge runtime in a standalone project: flip `runtime` to `"edge"`.

## What you get

- A minimal page: textarea + **Play** button. It POSTs your text to the route and plays the streamed audio.
- One route, `app/api/stream/route.ts`, that is the entire backend. It pipes the upstream MP3 body straight through as it arrives.

## The one file

The `@speechify/api` SDK is Node-only, so the route calls the REST API directly with `fetch` and streams the response body back unchanged:

```ts
import { verifyTurnstile } from "../../lib/turnstile";

// "nodejs" here because Vercel Services don't support Edge. Same file runs on
// the Edge runtime in a standalone project — just set this to "edge".
export const runtime = "nodejs";

const SPEECHIFY_STREAM_URL = "https://api.speechify.ai/v1/audio/stream";

export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { input } = (await req.json().catch(() => ({}))) as { input?: unknown };
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

  return new Response(upstream.body, {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
}
```

That is the whole backend.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8768
```

Open `http://localhost:8768`, type some text, and click **Play**.

## How the key stays server-side

`SPEECHIFY_API_KEY` is only ever read inside the function via `process.env`, which the browser cannot see. The client talks to the same-origin `/api/stream` route and receives audio bytes — never the key.

## Why streaming

Piping the upstream body straight to the client means the browser can start playing before synthesis finishes, with almost no server code in between. On the Edge runtime (standalone project) you also get fast cold starts and execution close to the user; under Services it runs on Node, and the streaming behaviour is identical.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
