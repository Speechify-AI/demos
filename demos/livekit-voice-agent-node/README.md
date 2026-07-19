# LiveKit voice agent (Node)

A minimal [LiveKit Agents](https://docs.livekit.io/agents/) voice assistant that speaks with Speechify text-to-speech via the [`@speechify/livekit-plugin`](https://www.npmjs.com/package/@speechify/livekit-plugin) package.

The agent wires three pieces into an `AgentSession`: Deepgram for speech-to-text, OpenAI for the LLM, and **Speechify for text-to-speech** (voice-activity detection is bundled by default). Swapping the TTS is a one-line change — `tts: new speechify.TTS(...)` — because the plugin implements LiveKit's standard `tts.TTS` interface.

## What you get

- `src/agent.ts` — the full agent: STT + LLM + Speechify TTS in one `AgentSession`
- `package.json` — pins `@speechify/livekit-plugin` plus the LiveKit plugin packages

## Run it

```bash
cp .env.example .env               # paste your keys
npm install
npm run download-files             # fetch bundled model files
npm run console                    # talk to the agent in your terminal
```

`console` runs the agent locally against your microphone and speakers — no LiveKit room required. To serve it to a real room instead, use `npm run dev` (development) or `npm run start` (production), which need the `LIVEKIT_*` variables in `.env`.

## The Speechify bit

```ts
import * as speechify from '@speechify/livekit-plugin';

tts: new speechify.TTS({ voiceId: 'dominic_32', model: 'simba-3.2' });
```

`speechify.TTS` streams audio and emits word-level timestamps (`alignedTranscript`), so LiveKit can render synced captions as the agent speaks. `simba-3.2` is the latest streaming-native model; the voice must support the chosen model (see the `/v1/voices` endpoint). Browse voices at [platform.speechify.ai](https://platform.speechify.ai).
