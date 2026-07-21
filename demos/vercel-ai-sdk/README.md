# SpeechifyAI through the Vercel AI SDK

Uses [`@speechify/vercel`](https://www.npmjs.com/package/@speechify/vercel) — the official SpeechifyAI provider for the [Vercel AI SDK](https://ai-sdk.dev) — to synthesize speech through the SDK's unified `generateSpeech` interface. If your app already uses the AI SDK for OpenAI, ElevenLabs, or Deepgram speech, switching to SpeechifyAI is a one-line model swap.

## What you get

- `output/hello.mp3` — synthesized with pure defaults (already committed, real API output): model `simba-3.2`, voice `geffen_32`, mp3
- `output/swap.mp3` — same interface with everything customized: voice, speed, and a telephony-grade codec string
- Word-level speech marks printed from `providerMetadata.speechify` — timing metadata SpeechifyAI returns on the same response, no forced-alignment pass needed

## Run it yourself

```bash
cp .env.example .env  # then paste your SPEECHIFY_API_KEY
npm install
npm start             # defaults demo → output/hello.mp3 + word timings
npm run swap          # customized demo → output/swap.mp3
```

## The one-line swap

Everything except the `model` assignment is provider-agnostic AI SDK code:

```ts
import { generateSpeech } from 'ai';
import { speechify } from '@speechify/vercel';

const { audio } = await generateSpeech({
  model: speechify.speech(), // ← the only SpeechifyAI-specific line
  text: 'Hello from SpeechifyAI!',
});
```

Coming from another provider? These are equivalent one-line changes:

```ts
model: openai.speech('tts-1')
model: elevenlabs.speech('eleven_multilingual_v2')
model: speechify.speech('simba-3.2')
```

## Speech marks

SpeechifyAI returns word- and sentence-level timing with every generation. The provider exposes them via provider metadata:

```ts
const result = await generateSpeech({ model: speechify.speech(), text });
const { speechMarks, billableCharactersCount } =
  result.providerMetadata.speechify;
```

See the [`captions-speech-marks/`](../captions-speech-marks) demo for turning these into WebVTT captions.

## Docs

- Provider README: [github.com/Speechify-AI/vercel-sdk](https://github.com/Speechify-AI/vercel-sdk)
- SpeechifyAI API docs: [docs.speechify.ai](https://docs.speechify.ai)
