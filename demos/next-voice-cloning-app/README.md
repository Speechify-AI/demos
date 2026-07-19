# Voice cloning web app (Next.js)

A small [Next.js](https://nextjs.org) app that clones a voice from an audio sample with the Speechify API, then synthesizes speech in that cloned voice. The API key stays server-side in a route handler and never reaches the browser.

Pairs with the blog post [Building an AI voice cloning web app with Next.js and Speechify](https://speechify.ai/blog/building-an-ai-voice-cloning-web-app-with-nextjs-and-speechify).

## What you get

- A one-page UI: upload a sample, enter consent, clone, then type text and hear it back in the cloned voice.
- Three server routes under `app/api/`, each holding the Speechify key server-side:
  - `POST /api/clone` — takes a multipart upload plus consent, calls `client.voices.create`, returns the new `voice_id`.
  - `POST /api/speak` — synthesizes text with a `voice_id` via `client.audio.speech`.
  - `DELETE /api/voice?id=…` — removes a cloned voice with `client.voices.delete`.
- `fixtures/spacewalk.wav` — a public-domain NASA sample so you can run the whole flow without recording anything.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
npm install
npm run dev            # http://localhost:8765
```

Open `http://localhost:8765`, pick `fixtures/spacewalk.wav` (or your own 10 to 30 second clip), fill in the consent name and email, and click **Clone voice**. Then type something into the second box and click **Synthesize with cloned voice**.

Voice cloning is gated by your Speechify plan. If it is not included, `POST /api/clone` returns `402` and the UI shows a plan message instead of a `voice_id`.

## How the key stays server-side

Every Speechify call happens inside an `app/api/*` route handler, which only ever runs on the server. The browser talks to those same-origin routes; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS.

## Where the code came from

The clone lifecycle mirrors the TypeScript SDK recipe in the [Speechify Cookbook](https://github.com/SpeechifyInc/speechify-api-cookbook/tree/main/recipes/audio/typescript/sdk/voice-cloning). This folder wraps that lifecycle in a Next.js UI with the key held server-side, which is how you would ship it in a real app.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys), on a plan that includes voice cloning
