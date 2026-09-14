# Speech generation with the AI SDK and Speechify (Next.js)

A small [Next.js](https://nextjs.org) app that generates speech with the
[AI SDK](https://ai-sdk.dev)'s `generateSpeech()` and a custom Speechify
speech model. The provider is a single dependency-free file that maps the AI
SDK's speech interface onto `POST /v1/audio/speech`. The API key stays
server-side in route handlers and never reaches the browser.

Pairs with the blog post [Speech generation in the Vercel AI SDK with Speechify](https://speechify.ai/blog/speech-generation-in-the-vercel-ai-sdk-with-speechify).

## What you get

- `app/lib/speechify-provider.ts` — the custom provider. Implements the AI
  SDK's `SpeechModelV4` interface with plain `fetch`: `doGenerate()` posts to
  `/v1/audio/speech`, passes the base64 audio through, surfaces
  `billable_characters_count` and `speech_marks` via `providerMetadata`, and
  reports unsupported settings (`speed`, `instructions`, `language`) as
  warnings instead of failing.
- Two server routes under `app/api/`, each holding the Speechify key
  server-side:
  - `POST /api/speech` — runs `generateSpeech()` with
    `speechify.speech("simba-3.2")` and returns the audio as base64 JSON.
  - `GET /api/voices` — fetches `GET /v1/voices` and returns the registered
    `simba-3.2` voices with display names.
- A one-page UI: pick a voice, type text, press generate, hear it back, and
  inspect the warnings and provider metadata the AI SDK returns.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
npm install
npm run dev            # http://localhost:8766/ai-sdk-speechify-speech
```

The app mounts under the `/ai-sdk-speechify-speech` base path locally and on
demos.speechify.ai, so the URL prefix is the same in both places.

## How the key stays server-side

Every Speechify call happens inside an `app/api/*` route handler, which only
runs on the server. The browser talks to those same-origin routes and never
sees `SPEECHIFY_API_KEY`. The provider file is imported only by a route
handler, so it is never bundled into client JS.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
