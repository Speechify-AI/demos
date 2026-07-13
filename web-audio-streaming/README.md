# Streaming TTS to the browser with Web Audio API

Streams raw PCM from [`POST /v1/audio/stream`](https://docs.speechify.ai/tts) through a local server proxy, then plays each network chunk in the browser with the Web Audio API. The API key stays server-side. The browser only talks to same-origin `POST /v1/audio/stream`.

## What you get

- A tiny browser demo at `http://localhost:8766/` with a text box, Play button, status line, chunk meter, and byte counters.
- A same-origin streaming proxy that forwards `POST /v1/audio/stream` to `api.speechify.ai` with `Accept: audio/pcm`.
- Browser code that converts 16-bit little-endian PCM into Float32 samples and queues each `AudioBuffer` back to back.

## Run it yourself

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm run demo          # serves the demo on http://localhost:8766
```

Open `http://localhost:8766/`, enter text, and click Play streaming TTS. The `AudioContext` is created from the click handler so browser autoplay policy is satisfied.

## How the demo server works

`npm run demo` runs [`src/server.ts`](./src/server.ts), a tiny zero-dep Node HTTP server. It does two things:

1. Serves `demo/index.html` as the static browser UI.
2. Proxies `POST /v1/audio/stream` straight to `api.speechify.ai`, adding the `Authorization: Bearer ${SPEECHIFY_API_KEY}` header server-side and forwarding the streamed audio bytes back to the browser.

The proxy forwards the request body unchanged, forces the key to stay on the server, and passes the stream through without buffering it into a full file first. The browser requests `Accept: audio/pcm`, so the response is raw 16-bit mono PCM at 24 kHz.

## Where the code came from

There is no cookbook browser recipe for this one because the important part is browser-specific: `AudioContext`, autoplay policy, and chunk scheduling. The server proxy follows the same pattern as the sibling `captions-speech-marks` demo. The browser side is built from the [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) primitives and Speechify's streaming endpoint.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
