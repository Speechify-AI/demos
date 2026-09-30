# Voice cloning narration

Clones a voice with verified consent using [`POST /v1/voices`](https://docs.speechify.ai/build/voice-cloning-api), synthesizes a line with the new voice using the standard `POST /v1/audio/speech` endpoint, then deletes the clone. The whole lifecycle in one TypeScript script, no SDK.

Pairs with the blog post [Dynamic video narration using the Speechify Voice Cloning API](https://speechify.ai/blog/dynamic-video-narration-using-the-speechify-voice-cloning-api).

## What you get

- `src/index.ts`: consent challenge, clone, synthesize, delete in one script
- `output/`: will contain `narration.mp3` after a successful run, on a plan that includes cloning

## Verified consent

Speechify cloning requires **verified consent**. The script creates a consent challenge with `POST /v1/voices/consent-challenges`, the speaker records themselves reading the returned phrase, and that recording is sent as `consent_recording` with the challenge's `id` as `consent_challenge_id`, alongside the voice `sample`. It is kept as the consent record for the voice.

The consent recording **must be the same person** as the voice sample, so this demo is bring-your-own-audio: there is no canned sample that carries valid consent. The script pins `Speechify-Version: 2026-09-13`, the API version this flow ships on. The old `consent` field (a name and email as a JSON string) is removed; see the [migration guide](https://docs.speechify.ai/build/migrating-voice-cloning-consent) and the [consent guide](https://docs.speechify.ai/build/guides/voice-cloning/consent).

## Run it

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY and set CONSENT_FULL_NAME
npm install
npm start             # first run: creates a consent challenge and prints the phrase
```

The first run prints a phrase and exits. Then:

1. Record the speaker reading the phrase exactly as written, 5-30 seconds, and save it as `consent.wav`.
2. Save 10-30 seconds of the same speaker's clean speech as `sample.wav`.
3. Run `npm start` again before the challenge expires. It clones, synthesizes `output/narration.mp3`, and deletes the clone.

Set `SAMPLE_PATH` and `CONSENT_RECORDING_PATH` in `.env` to read the recordings from somewhere else. The challenge is saved in `.consent-challenge.json` between runs and is single use: once a create has used it, successful or not, the next run gets a new phrase.

## When consent is refused

A refused create comes back with a code that says why, and the challenge is spent either way:

| Status | Code | What to do |
| --- | --- | --- |
| 422 | `consent_phrase_mismatch` | Record the phrase again, exactly as written. |
| 422 | `consent_speaker_mismatch` | The person reading the phrase has to be the person in the sample. |
| 422 | `consent_recording_unusable` | Record again, 5-30 seconds, somewhere quiet. |
| 409 | `consent_challenge_expired`, `consent_challenge_already_used` | Run again for a new phrase. |

The script deletes the saved challenge on any of these, so the next run starts with a new phrase. Your sample is still good.

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

## The Content-Type gotcha

When you pass a `FormData` to `fetch`, do **not** set `Content-Type: multipart/form-data` manually. `fetch` sets the boundary itself from the FormData instance. Setting the header yourself produces a wrong or missing boundary and the upload fails with a non-obvious error. This script gets it right by only setting the `Authorization` and `Speechify-Version` headers on the create call.

## Where the code came from

This is the TypeScript native (no-SDK) recipe from the [Speechify Cookbook](https://github.com/Speechify-AI/cookbook/tree/main/recipes/audio/typescript/native/voice-cloning). The cookbook is the canonical home for the recipe.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
- A Speechify plan that includes voice cloning
- Two recordings of the same speaker: a voice sample and the consent phrase
