# Streaming TTS karaoke

Realtime text-to-speech with word timestamps. Speechify's streaming endpoint
returns audio **and** per-word timings as it synthesizes, so this demo shows two
highlights at once:

1. **Received** — each word lights up the instant its audio + timestamp arrive
   over the stream. This is the wire speed: the marks race ahead of playback.
2. **Playing** — a second highlight follows the actual audio position as it plays
   back through the browser.

The Speechify API key never reaches the browser — the page talks to a one-route
server proxy.

Pairs with the Speechify post *Realtime streaming TTS with word highlighting*.

## What you get

- **[`app/api/stream/route.ts`](./app/api/stream/route.ts)** — a Node route that
  proxies `POST /v1/audio/stream/with-timestamps` (Server-Sent Events) and pipes
  it straight to the browser, key held server-side.
- **[`app/page.tsx`](./app/page.tsx)** — parses the SSE `speech.chunk` events,
  maps each word mark to the rendered text by character offset (the "received"
  highlight), streams the base64 audio into a `<audio>` element with the
  [MediaSource API](https://developer.mozilla.org/docs/Web/API/Media_Source_Extensions_API),
  and follows playback with `requestAnimationFrame` (the "playing" highlight).

## How the endpoint works

`POST /v1/audio/stream/with-timestamps` streams SSE events:

- `speech.chunk` — carries a run of base64 `audio`, a batch of `speech_marks`, or
  both. Marks are `{ value, start, end, start_time, end_time }` where `start`/`end`
  are character offsets into your input and the times are **absolute
  milliseconds** from the start of synthesis. Concatenate the audio into one
  stream and apply the marks against that single timeline.
- `speech.done` — terminal, with `billable_characters_count` and `audio_duration_ms`.
- `speech.error` — terminal error envelope.

Speech marks come from the streaming-native models: `simba-3.2` (used here) and
`simba-3.0`. The legacy `simba-english` / `simba-multilingual` models return
`400 speech_marks_unsupported` on this route.

## Run it yourself

```bash
cp .env.example .env      # paste your Speechify API key
pnpm install
pnpm dev                  # http://localhost:8775/streaming-tts-karaoke
```

Get an API key at [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Tests

```bash
pnpm e2e                  # Playwright, drives the real streaming API
```

## Prerequisites

- Node 20+.
- A browser with MediaSource support for `audio/mpeg` (Chrome/Edge). Where it's
  unavailable the demo buffers the clip and plays it at the end — the "received"
  highlight still streams live.
