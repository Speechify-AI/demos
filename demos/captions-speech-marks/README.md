# Captions from Speechify TTS speech marks

Synthesizes audio with [`POST /v1/audio/speech`](https://docs.speechify.ai/tts) and turns the word-level `speech_marks` the same response returns into a valid WebVTT file. The browser then renders the captions automatically via an `<audio>` + `<track>` pair.

## What you get

- `output/sample.mp3` — synthesized audio (already committed, real API output)
- `output/sample.vtt` — matching WebVTT cues, one per word
- `output/sample.json` — the raw `speech_marks` array, kept for reference
- A small two-page browser demo:
  - **`/synth`** — click a button, watch the real `POST /v1/audio/speech` land in the browser Network panel and hear the result.
  - **`/karaoke`** — audio player with word-by-word highlight driven by the `cuechange` event on the `TextTrack`.

## Run it yourself

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm start             # rewrites output/sample.mp3, .vtt, .json
npm run demo          # serves the two-page demo on http://localhost:8765
```

Open `http://localhost:8765/` to land on the synth page, or `/karaoke` to jump straight to the playback demo.

## How the demo server works

`npm run demo` runs [`src/server.ts`](./src/server.ts), a tiny zero-dep Node HTTP server. It does two things:

1. Serves `demo/synth.html`, `demo/karaoke.html`, and the static `output/*` files.
2. Proxies `POST /v1/audio/speech` straight to `api.speechify.ai`, adding the `Authorization: Bearer ${SPEECHIFY_API_KEY}` header server-side.

That second part is the point: the synth page POSTs to a same-origin `/v1/audio/speech`, the server forwards it upstream with the key, the response comes back unchanged. Same path, same body, same response shape — the key just never reaches the client. It is how you would wire this in a real app.

## Where the code came from

This is the TypeScript native (no-SDK) recipe from the [Speechify Cookbook](https://github.com/SpeechifyInc/speechify-api-cookbook/tree/main/recipes/audio/typescript/native/speech-marks). The cookbook is the canonical home for the recipe; this folder is the matching demo that produces the audio + captions + visualisations the blog post references.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
