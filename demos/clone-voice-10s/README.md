# Clone a voice from 10 seconds (Next.js)

A small [Next.js](https://nextjs.org) app that clones a voice from a ~10 second sample with the Speechify API, synthesizes with the clone, then deletes it — all in one click, with consent as a first-class step. The API key stays server-side in route handlers and never reaches the browser.

Pairs with the blog post "Clone a voice from 10 seconds and ship it today".

## What you get

- A one-page flow: drop a short sample, confirm consent, then **clone → speak → delete** in a single action. The clone never lingers in your workspace.
- Guidance on the sample: a 10 to 30 second WAV of one speaker works best (aim for ~10 seconds of clean, single-speaker audio).
- A real consent gate: a required checkbox ("I have the speaker's consent to clone this voice") plus the consenting person's full name and email. Cloning is blocked — client and server side — until consent is confirmed.
- Three server routes under `app/api/`, each holding the Speechify key server-side:
  - `POST /api/clone` — multipart upload plus consent, calls `client.voices.create` with `consent: JSON.stringify({ fullName, email })`, returns the new `voice_id`. Returns `402` with a friendly message if cloning isn't on your plan.
  - `POST /api/speak` — synthesizes text with the `voice_id` via `client.audio.speech` (`simba-english`, safe for clones).
  - `DELETE /api/voice?id=…` — removes the cloned voice with `client.voices.delete`.
- `fixtures/spacewalk.wav` — a public-domain NASA sample so you can run the whole flow without recording anything.

## Voice cloning consent and safety

Cloning a voice needs the speaker's consent. Speechify verifies consent when you clone — see the announcement, [Voice cloning now verifies consent](https://speechify.ai/blog/voice-cloning-verified-consent), and the [Voice Cloning Consent and Safety](https://speechify.ai/voice-cloning/consent-and-safety) page. This demo makes that explicit in the UI: it records the consenting person's name and email and won't call the clone API until you confirm you have consent.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8772
```

Open `http://localhost:8772`, pick `fixtures/spacewalk.wav` (or your own ~10 second clip), fill in the consent name and email, tick the consent box, then click **Clone, speak, then delete**. You'll get audio back in the cloned voice, and the clone is removed straight after.

Voice cloning is gated by your Speechify plan. If it isn't included, `POST /api/clone` returns `402` and the UI shows a plan message instead of a `voice_id`.

## How the key stays server-side

Every Speechify call happens inside an `app/api/*` route handler, which only ever runs on the server. The browser talks to those same-origin routes; it never sees `SPEECHIFY_API_KEY`. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS. Each route also verifies a Cloudflare Turnstile token before doing any work.

## Where the code came from

The clone lifecycle mirrors the TypeScript SDK recipe in the [Speechify Cookbook](https://github.com/SpeechifyInc/speechify-api-cookbook/tree/main/recipes/audio/typescript/sdk/voice-cloning). This folder wraps that lifecycle in a Next.js UI with the key held server-side and an explicit consent + auto-delete flow, which is how you'd ship it responsibly in a real app.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys), on a plan that includes voice cloning
