# IVR pronunciation with SSML (Next.js)

A focused [Next.js](https://nextjs.org) playground for getting names, account numbers, and product terms right in an IVR (phone system) with SSML on the Speechify API. Four realistic IVR lines, each with a **plain** and an **SSML** version so you can hear the difference, edit the markup, and re-synthesize. The API key stays server-side in a route handler and never reaches the browser.

Pairs with the blog post "Nailing pronunciation in an IVR with SSML". It's the practical follow-up to the earlier [Controlling Emotion and Timing in TTS with SSML](https://speechify.ai/blog/controlling-emotion-and-timing-in-tts-with-ssml) — same SSML toolkit, aimed squarely at the pronunciation problems a phone system hits every call.

## What you get

- A one-page UI with four IVR presets, each pairing plain text with the SSML you'd actually ship:
  - **Caller name** — a tricky name via `<sub alias="…">` so it isn't guessed.
  - **Account number** — `<sub alias="…">` spells the digits out so callers can write them down, with a `<break>` between the groups.
  - **Product / brand term** — `<sub alias="…">` for how a run-together brand should sound.
  - **Menu line** — `<prosody rate="slow">` and `<break>` so callers have time to choose.
- A **Plain / SSML** toggle: hear the raw line, then the corrected one.
- An editable SSML textarea — change the aliases, pauses, or rate and re-synthesize.
- One server route, `POST /api/speak`, holding the Speechify key server-side. It sends your string (plain text or SSML) to `client.audio.speech` with `simba-3.2` / `geffen_32` and returns base64 MP3.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8770
```

Open `http://localhost:8770`, pick an IVR line, toggle **Plain** to hear the naive read, then **SSML** to hear it fixed. Edit the SSML and hit **Synthesize SSML** again to iterate.

## How the key stays server-side

The Speechify call happens inside `app/api/speak/route.ts`, which only ever runs on the server. The browser posts your string to that same-origin route; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS. Requests are gated with Cloudflare Turnstile (fail-open locally when `TURNSTILE_SECRET_KEY` is unset).

## Where the code came from

The SSML tags mirror the ones in the [SSML emotion TTS](../ssml-emotion-tts) demo and the [Speechify SSML docs](https://docs.speechify.ai). This folder narrows that toolkit to the IVR pronunciation problem and wraps it in a Next.js UI with the key held server-side, which is how you'd ship it in a real app.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
