# LiveKit voice agent (Node)

A minimal [LiveKit Agents](https://docs.livekit.io/agents/) voice assistant in TypeScript that speaks with Speechify text-to-speech by calling the [Speechify streaming API](https://docs.speechify.ai) directly.

LiveKit's official Speechify plugin for Node, `@livekit/agents-plugin-speechify`, is not published on npm yet. Until it is, `src/speechify_tts.ts` implements LiveKit's standard `tts.TTS` interface with plain `fetch` and no Speechify SDK. Once the plugin ships, this demo will switch to it and drop that file.

The agent wires three pieces into an `AgentSession`: Deepgram for speech-to-text, OpenAI for the LLM, and **Speechify for text-to-speech** (voice-activity detection is bundled by default). It greets you with `session.say(...)`, so the first thing you hear is Speechify reading a fixed line.

## What you get

- `src/agent.ts`: the agent, STT + LLM + Speechify TTS in one `AgentSession`
- `src/speechify_tts.ts`: `SpeechifyTTS`, a small `tts.TTS` over `POST /v1/audio/stream`
- `package.json`: `@livekit/agents` 1.9.1 with the matching Deepgram and OpenAI plugins (each plugin requires that exact `@livekit/agents` version)

## Run it

```bash
cp .env.example .env               # paste your keys
npm install
npm run dev                        # register the worker with your LiveKit project
```

Then open the [Agents Playground](https://agents-playground.livekit.io), connect to the same LiveKit project and start talking: the worker joins the room and greets you. `npm run start` runs the same worker in production mode. Both need the `LIVEKIT_*` variables in `.env`, pointing at LiveKit Cloud or at a local `livekit-server --dev` (`ws://127.0.0.1:7880`, key `devkey`, secret `secret`).

There is no standalone terminal console for Node agents: the Node CLI's `console` command is driven by the [LiveKit CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/) (`lk agent console`), which is also where LiveKit's deprecation notice for `dev` points.

## The Speechify bit

```ts
import { SpeechifyTTS } from './speechify_tts.js';

tts: new SpeechifyTTS({ voiceId: 'dominic_32', model: 'simba-3.2' });
```

- Each synthesis is one `POST https://api.speechify.ai/v1/audio/stream` with `{ input, voice_id, model, output_format: "pcm_24000" }`, authenticated with `SPEECHIFY_API_KEY` as a Bearer token.
- The response is raw 24 kHz mono 16-bit PCM. It is cut into 100 ms frames with LiveKit's `AudioByteStream` as it arrives, and the last frame is marked `final`.
- `SpeechifyTTS` is non-streaming in LiveKit's sense (whole text in, audio out), so `AgentSession` wraps it in `tts.StreamAdapter` automatically: the LLM reply is split into sentences, and each sentence becomes one request that starts while the previous one is still playing.
- A non-2xx response raises `APIStatusError` with the status code and Speechify request id, never the text or the response body. A network failure raises `APIConnectionError`, and no audio for `timeoutMs` (10 s by default) raises `APITimeoutError`. LiveKit retries retryable errors, but only before any audio has gone out, so a retry never repeats the start of a sentence.
- Transcripts sync sentence by sentence. The streaming endpoint returns audio only, so there are no word-level timestamps here; the [Python captions demo](../livekit-captions-speechify-python) shows those through LiveKit's Python plugin.

`simba-3.2` is the lowest-latency streaming-native model and is English only; the voice must support the chosen model (see the `/v1/voices` endpoint). Browse voices at [platform.speechify.ai](https://platform.speechify.ai).

## Prerequisites

- Node.js 22 or newer.
- `SPEECHIFY_API_KEY` for Speechify TTS.
- `DEEPGRAM_API_KEY` for speech-to-text and `OPENAI_API_KEY` for the LLM.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` for the LiveKit project (or local server) the worker registers with.
