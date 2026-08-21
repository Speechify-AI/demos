# Live captions with speech marks (Next.js)

A small [Next.js](https://nextjs.org) app that synthesizes text with the Speechify API and renders live, word-by-word captions in sync with playback. Each word lights up the instant the voice speaks it, driven entirely by the `speech_marks` the API returns alongside the audio. The API key stays server-side in a route handler and never reaches the browser.

This is the hostable web update of the earlier post [Building real-time captions with Speechify TTS speech marks](https://speechify.ai/blog/building-real-time-captions-with-speechify-tts-speech-marks). That original framed the captions as a browser extension; this demo ships the same speech-marks logic as a page you can host and run in a browser.

## What you get

- A one-page UI: type text, click **Synthesize**, press play, and watch each word highlight in real time.
- One server route holding the Speechify key server-side:
  - `POST /api/speak` — synthesizes text with `client.audio.speech` (model `simba-3.2`, voice `geffen_32`, MP3) and returns `{ audio, speechMarks }`, where `speechMarks` is `response.speech_marks.chunks` — one entry per word with `start_time` / `end_time` in milliseconds and the word `value`.
- The sync loop: the client plays the base64 MP3 and, on every `requestAnimationFrame`, reads `audio.currentTime` and highlights the word whose `[start_time, end_time)` window contains the current position (found with a binary search). No forced alignment, no polling timer, no custom audio decoder.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8771
```

Open `http://localhost:8771`, edit the text if you like, click **Synthesize**, then press play on the audio control.

## Dropping this into a real browser extension

The original post built this as a browser extension, and the timing logic here is exactly what an extension content script needs. The `speech_marks` chunks are the whole trick: given `audio.currentTime`, `activeIndexAt()` in `app/page.tsx` returns the word to highlight. In a content script you keep that function verbatim and swap the React state update for a `classList` toggle on the words already in the page's DOM. The server route stays the same — it is where your key lives — and the extension calls it the way this page does.

## How the key stays server-side

Every Speechify call happens inside the `app/api/speak` route handler, which only ever runs on the server. The browser talks to that same-origin route; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS.

## Where the code came from

The speech-marks-to-captions logic mirrors the [captions-speech-marks](../captions-speech-marks) demo, which turns the same `speech_marks` chunks into WebVTT cues. This folder drives live highlighting from those chunks instead, and wraps it in a Next.js UI with the key held server-side — which is how you would ship it in a real app.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
