# Voice in a React app

A drop-in React component that adds a Speechify voice to any app. Give it text,
it plays that text as speech. The Speechify API key never reaches the browser —
synthesis goes through a one-route server proxy.

Pairs with the Speechify post *Adding a voice to a React app with the Speechify
SDK*. It complements (doesn't repeat)
[Building an AI Voice Cloning Web App with Next.js and Speechify](https://speechify.ai/blog/building-an-ai-voice-cloning-web-app-with-nextjs-and-speechify)
— read that one for the full cloning app.

## What you get

- **[`components/SpeechifyVoice.tsx`](./components/SpeechifyVoice.tsx)** — the
  whole point. Under 100 lines. Props: `text`, optional `voiceId`, `endpoint`,
  `label`, and a `getToken` hook for abuse-gated deployments. Copy it into your
  own app.
- **[`app/api/speak/route.ts`](./app/api/speak/route.ts)** — a Next.js route
  handler that calls `client.audio.speech(...)` server-side and returns base64
  MP3, so `SPEECHIFY_API_KEY` stays on the server.
- A small page (`app/page.tsx`) that wires the component to a textarea and a
  voice picker.

## Run it yourself

```bash
cp .env.example .env      # paste your Speechify API key
pnpm install
pnpm dev                  # http://localhost:8767/react-tts-component
```

Get an API key at [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Use the component in your app

```tsx
import { SpeechifyVoice } from "./components/SpeechifyVoice";

<SpeechifyVoice text="Hello from Speechify." voiceId="geffen_32" />;
```

The component POSTs `{ text, voiceId }` to `endpoint` (default `/api/speak`),
expects `{ audio }` (base64 MP3) back, and plays it. Point `endpoint` at your
own proxy route in any framework — the component doesn't care what's behind it.

## Where the code came from

Built on the [`@speechify/api`](https://www.npmjs.com/package/@speechify/api)
TTS client — one `client.audio.speech({ input, voice_id, audio_format, model })`
call. Model `simba-3.2`, MP3 output. Browse voices at
[platform.speechify.ai](https://platform.speechify.ai).

## Abuse protection (hosted)

The hosted build gates `/api/speak` with Cloudflare Turnstile via the shared
[`app/lib/turnstile.ts`](./app/lib/turnstile.ts) helper. It fail-opens when
`TURNSTILE_SECRET_KEY` is unset, so local dev and forks work with zero config.

## Prerequisites

- Node 20+.
- A Speechify API key (the free tier covers this demo).
