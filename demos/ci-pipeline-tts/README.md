# Make your CI pipeline talk with Speechify TTS

Wires the Speechify TTS API into a CI pipeline so build, test, and deploy
events are spoken aloud instead of only living in logs. Trigger it on a
workflow that finishes and it turns the outcome into an MP3 — saved locally,
and optionally dropped into a Discord channel as audio.

This pairs with the [Make your CI pipeline talk](https://speechify.ai/blog)
post.

## What you get

- `src/lib/speech.ts` — builds and validates a `POST /v1/audio/speech` request
  against the documented API contract (model, voice, format, 2,000-char input
  limit), so a bad call fails locally before it costs a request.
- `src/lib/message.ts` — turns raw CI facts (repo, branch, commit, status) into
  a spoken sentence.
- `src/index.ts` — a script that synthesizes the event and writes
  `output/ci-event.mp3`, with an optional Discord webhook upload.
- `.github/workflows/speak-build-events.yml` — an example workflow you copy into
  your own repo to speak on every build.
- `npm test` — unit tests that pin the request code to the live API docs.

## Run it yourself

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm start             # writes output/ci-event.mp3
```

Pass event facts on the CLI (or let it read `GITHUB_*` env vars in a workflow):

```bash
npm start -- \
  --workflow "Build and test" \
  --repo speechify-api \
  --branch main \
  --sha 4f2ab1c9d3 \
  --actor luke \
  --status success \
  --message "fix flaky test"
```

Set `DISCORD_WEBHOOK_URL` in `.env` to also post the MP3 into a Discord channel.

## How the demo server works

There is no demo server for this one. `npm start` builds the spoken message,
validates and constructs the speech request, calls
`POST https://api.speechify.ai/v1/audio/speech` through the official
`@speechify/api` SDK, and writes the returned base64 MP3 to
`output/ci-event.mp3`. The SDK reads `SPEECHIFY_API_KEY` for auth.

The demo uses the recommended English model `simba-3.2` with one of its curated
voices (`geffen_32` by default). Model and voice are configurable via
`SPEECHIFY_MODEL` and `SPEECHIFY_VOICE_ID`.

## Testing against the docs

`npm test` runs the unit tests in `test/`. They assert the request shape and
every guard in `src/lib/speech.ts` matches the live reference at
[docs.speechify.ai](https://docs.speechify.ai/build/api-reference/v1/audio/speech):

- the endpoint is `POST https://api.speechify.ai/v1/audio/speech`,
- the body is exactly `{ input, voice_id, audio_format, model }`,
- the only models are `simba-3.0` and `simba-3.2` (the Simba 1.6 models are
  retired and excluded),
- `simba-3.2` accepts only its curated voices,
- `audio_format` is one of `wav`, `mp3`, `ogg`, `aac`, `pcm`,
- input stays within the 2,000-character limit.

No API key is needed to run the tests; they never call the network.

## Where the code came from

Built from the [Text-to-speech API docs](https://docs.speechify.ai/build/text-to-speech-api)
and the [Generate Speech reference](https://docs.speechify.ai/build/api-reference/v1/audio/speech).

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
