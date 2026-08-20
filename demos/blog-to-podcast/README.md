# Blog post to podcast episode (Next.js)

A small [Next.js](https://nextjs.org) app that turns a long-form article into a podcast episode. Paste plain text or simple markdown, and the Speechify TTS API narrates it in a host-quality voice. The API key stays server-side in a route handler and never reaches the browser.

Pairs with the blog post [Turn this blog post into a podcast episode with the Speechify API](https://speechify.ai/blog). It complements Speechify's [podcast generation](https://speechify.ai/tts/podcast-generation) page — this is the API-first, "build it yourself" version.

## What you get

- A one-page UI: paste an article, pick a voice, generate the episode, and play it back-to-back as one continuous listen with a segment playlist and progress view.
- One server route, `POST /api/episode`, that holds the Speechify key server-side:
  - Chunks the text on **sentence boundaries** into ~500–800 character segments, packing whole paragraphs together where they fit and falling back to sentence splits (`(?<=[.!?])\s+`) only when a paragraph is larger than the cap. The lookbehind keeps punctuation attached so abbreviations like "Mr. Smith" are not torn apart.
  - Optionally prepends a short "You're listening to…" intro so it opens like an episode.
  - Synthesizes each chunk with `client.audio.speech` (model `simba-3.2`, `audio_format: "mp3"`) and returns `{ chunks: [{ audio, text }] }` where `audio` is base64 mp3.
- **Optional 2-voice reading.** Pick a guest voice and the reading alternates host/guest per paragraph — a simple back-and-forth. Leave it on "None" for a single narrator.
- **Download episode.** Concatenates the mp3 segment blobs into one `episode.mp3`. This is naive Blob concatenation of the mp3 parts — fine for a demo listen; a production pipeline would remux with `ffmpeg -f concat` (see the `audiobook-pipeline` demo).

## Limits

- Input is capped at **8,000 characters** to keep the demo cheap. Longer articles are rejected with a message; the character counter in the UI warns you before you hit it.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8773
```

Open `http://localhost:8773`, paste an article (a sample is pre-filled), pick a host voice, and click **Generate episode**. When it's ready, press **Play episode** — each segment plays into the next automatically — or **Download episode** to save the mp3.

## How the key stays server-side

The Speechify call happens inside the `app/api/episode` route handler, which only ever runs on the server. The browser talks to that same-origin route; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS. Requests are gated with Cloudflare Turnstile — when `TURNSTILE_SECRET_KEY` is unset (local dev), the gate fails open.

## Where the code came from

The sentence-boundary chunker follows the same approach as the [`audiobook-pipeline`](../audiobook-pipeline) demo, adapted to a Next.js route and the TypeScript SDK. Synthesis uses `client.audio.speech` from [`@speechify/api`](https://www.npmjs.com/package/@speechify/api).

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
