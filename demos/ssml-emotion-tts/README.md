# SSML timing and pronunciation with Speechify TTS

Synthesizes audio with the Speechify TypeScript SDK and an SSML document that combines `break`, `prosody rate`, and `sub` tags in one `POST /v1/audio/speech` request.

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

The SSML document is the whole point: the same request mixes a half-second pause, a slower passage, shorter beats between instructions, and a pronunciation substitution.

These are the tags `simba-3.2` and `simba-3.0` apply. Emotion (`speechify:style`), pitch, volume, and emphasis tags are accepted and not applied on current models, so this demo leaves them out. See [which tags each model applies](https://docs.speechify.ai/build/guides/text-to-speech/ssml).

## Where the code came from

This is the TypeScript SDK recipe from the [Speechify Cookbook](https://github.com/Speechify-AI/cookbook/tree/main/recipes/audio/typescript/sdk/ssml-emotion). The cookbook is the canonical home for the recipe; this folder is the matching demo that produces the audio the blog post references.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
