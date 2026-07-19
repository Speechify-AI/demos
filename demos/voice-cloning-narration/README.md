# Voice cloning narration

Clones a voice from a short WAV sample using [`POST /v1/voices`](https://docs.speechify.ai/tts), synthesizes a line with the new voice using the standard `POST /v1/audio/speech` endpoint, then deletes the clone. End-to-end lifecycle in roughly 30 lines of TypeScript.

## What you get

- `src/index.ts` — clone, synthesize, delete in one script
- `fixtures/spacewalk.wav` — sample audio for the clone (NASA ISS spacewalk, public domain, ~26 sec)
- `output/` — will contain `narration.mp3` after a successful run, on a plan that includes cloning

## Voice cloning is plan-gated

The API returns a `402 voice_cloning_not_included` error envelope if your current Speechify plan does not include voice cloning. The script handles the 402 path and exits cleanly with a message pointing at the [pricing page](https://speechify.ai/pricing). The error envelope shape:

```json
{
  "error": {
    "code": "voice_cloning_not_included",
    "message": "current billing plan does not have access to voice cloning"
  },
  "request_id": "..."
}
```

If you see that, you need a plan that includes cloning before this demo runs to completion.

## Run it

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm start             # clones, synthesizes, deletes
```

A successful run produces `output/narration.mp3`.

## The Content-Type gotcha

When you pass a `FormData` to `fetch`, do **not** set `Content-Type: multipart/form-data` manually. `fetch` sets the boundary itself from the FormData instance. Setting the header yourself produces a wrong/missing boundary and the upload fails with a non-obvious error. This script gets it right by only setting the `Authorization` header on the create call.

## Where the code came from

This is the TypeScript native (no-SDK) recipe from the [Speechify Cookbook](https://github.com/SpeechifyInc/speechify-api-cookbook/tree/main/recipes/audio/typescript/native/voice-cloning). The cookbook is the canonical home for the recipe.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [console.speechify.ai/api-keys](https://console.speechify.ai/api-keys)
- A Speechify plan that includes voice cloning
