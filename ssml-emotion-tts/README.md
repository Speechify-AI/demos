# SSML emotion and timing with Speechify TTS

Synthesizes audio with the Speechify TypeScript SDK and an SSML document that combines `speechify:style`, `break`, `prosody`, `emphasis`, and `sub` tags in one `POST /v1/audio/speech` request.

## What you get

- `output/ssml-emotion.mp3` — synthesized audio (already committed, real API output)
- A terminal-only demo that writes the MP3 and logs the billable character count returned by the API.

## Run it yourself

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm start             # rewrites output/ssml-emotion.mp3
```

## How the demo server works

There is no demo server for this one. `npm start` runs [`src/index.ts`](./src/index.ts), sends the SSML document directly to Speechify with the API key from `SPEECHIFY_API_KEY`, and writes the returned base64 MP3 to `output/ssml-emotion.mp3`.

The SSML document is the whole point: the same request mixes a warm opening, a half-second pause, slower low-pitch instructions, an assertive warning, strong emphasis, and a pronunciation substitution.

## Where the code came from

This is the TypeScript SDK recipe from the [Speechify Cookbook](https://github.com/SpeechifyInc/speechify-api-cookbook/tree/main/recipes/audio/typescript/sdk/ssml-emotion). The cookbook is the canonical home for the recipe; this folder is the matching demo that produces the audio the blog post references.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
