# Voice cloning web app (Next.js)

A small [Next.js](https://nextjs.org) app that clones a voice from an audio sample with the Speechify API, then synthesizes speech in that cloned voice. The API key stays server-side in a route handler and never reaches the browser.

Pairs with the blog post [Building an AI voice cloning web app with Next.js and Speechify](https://speechify.ai/blog/building-an-ai-voice-cloning-web-app-with-nextjs-and-speechify).

## What you get

- A one-page UI: upload a sample, record verified consent in the browser, clone, then type text and hear it back in the cloned voice.
- Four server routes under `app/api/`, each holding the Speechify key server-side:
  - `POST /api/consent-challenge` — takes the consenting person's name, calls `client.voices.consentChallenges.create`, returns the `phrase` to read aloud and a single-use `challengeId`.
  - `POST /api/clone` — takes the sample, the consent recording and the `challengeId`, calls `client.voices.create`, returns the new `voice_id`.
  - `POST /api/speak` — synthesizes text with a `voice_id` via `client.audio.speech`.
  - `DELETE /api/voice?id=…` — removes a cloned voice with `client.voices.delete`.

## Verified consent

Speechify cloning requires **verified consent**: you mint a consent challenge, the speaker records themselves reading the returned phrase, and that recording is sent alongside the sample and kept as the consent record. The consent recording **must be the same person** as the voice sample. So this app is bring-your-own-audio — upload the speaker's sample and record them reading the phrase in-browser; there is no canned sample that carries valid consent.

The client pins `Speechify-Version: 2026-09-13`, the API version this flow ships on. The old `consent` field (name + email) is removed — see the [migration guide](https://docs.speechify.ai/build/guides/deprecations/migrating-voice-cloning-consent).

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
npm install
npm run dev            # http://localhost:8765
```

Open `http://localhost:8765`, then:

1. Upload a 10–30s voice sample and enter the consenting person's name, and click **Get consent phrase**.
2. Have the same person read the phrase aloud into your mic — **Record consent**, then **Stop** (allow microphone access). Play it back, then click **Clone voice**.
3. Type something into the last box and click **Synthesize with cloned voice**.

Voice cloning is gated by your Speechify plan. If it is not included, `POST /api/clone` returns `402` and the UI shows a plan message instead of a `voice_id`.

## How the key stays server-side

Every Speechify call happens inside an `app/api/*` route handler, which only ever runs on the server. The browser talks to those same-origin routes; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS.

## Where the code came from

The clone lifecycle mirrors the TypeScript SDK recipe in the [Speechify Cookbook](https://github.com/Speechify-AI/cookbook/tree/main/recipes/audio/typescript/sdk/voice-cloning). This folder wraps that lifecycle in a Next.js UI with the key held server-side, which is how you would ship it in a real app.

## Prerequisites

- Node 20 or newer
- A microphone (to record the consent phrase in the browser)
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys), on a plan that includes voice cloning
