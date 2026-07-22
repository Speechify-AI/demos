# Multilingual voiceover (Next.js)

A small [Next.js](https://nextjs.org) app that generates the same short line in
six languages with the Speechify TTS API. Each language is paired with a
[`simba-3.0`](https://docs.speechify.ai) voice that serves that locale, and
synthesis runs through `POST /v1/audio/speech` in a server route so the API key
never reaches the browser.

Pairs with the blog post [Multilingual voiceover with the Speechify API and simba-3.0](https://speechify.ai/blog/multilingual-voiceover-with-speechify-and-simba-3-0).

## What you get

- `app/lib/languages.ts` — the language list. Each entry is a locale, a
  `simba-3.0` voice id that serves it (`GET /v1/voices`), and a native sample
  line. English, German, Spanish (Mexico), French, Italian, and Portuguese
  (Brazil).
- `app/api/speech/route.ts` — a server route that looks up the language, calls
  `POST /v1/audio/speech` with `model: "simba-3.0"` and the matching `voice_id`,
  and returns base64 MP3 plus the billable character count. Turnstile-gated,
  key held server-side.
- A one-page UI: pick a language, read the line it will speak, generate, and
  play it back.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
npm install
npm run dev            # http://localhost:8767/multilingual-voiceover
```

The app mounts under the `/multilingual-voiceover` base path locally and on
demos.speechify.ai, so the URL prefix is the same in both places.

## How the key stays server-side

The Speechify call happens inside `app/api/speech/route.ts`, which only runs on
the server. The browser posts a language code to that same-origin route and gets
audio back; it never sees `SPEECHIFY_API_KEY`.

## Notes on language coverage

`simba-3.0` covers English plus German, Spanish, French, Italian, and
Portuguese, routed by the voice's locale. Spanish here is `es-MX`, because no
`es-ES` voice lists `simba-3.0` today. For English-only work with the lowest
time to first byte, `simba-3.2` is the recommended model instead.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
