# Mastra agent with Speechify TTS

A minimal [Mastra](https://mastra.ai) agent that speaks with Speechify text-to-speech via the [`@mastra/voice-speechify`](https://www.npmjs.com/package/@mastra/voice-speechify) package. Defaults to `simba-3.2` — Speechify's latest streaming-native model — paired with the curated `harper_32` voice.

The agent wires two pieces: OpenAI (via AI SDK) for the LLM, and **Speechify for text-to-speech**. Every turn generates a short reply and speaks it. Audio for each turn is saved to `./out/turn-NNN.mp3` and auto-played if a system audio player is available (`afplay` on macOS; `mpg123`, `ffplay`, or `play` on Linux).

## What you get

- `src/index.ts` — the full agent: a Mastra `Agent` with `SpeechifyVoice` attached, plus a small text-in / speech-out REPL
- `package.json` — pins `@mastra/voice-speechify@0.14.0-alpha.0` (the first release that ships Simba 3.2 support) and `@mastra/core@1.51.0-alpha.10`

## Run it

```bash
cp .env.example .env               # paste your keys
npm install
npm run chat                       # type a message, hear the reply
```

Type a message, press Enter, listen to the response. Empty line quits.

## The Speechify bit

```ts
import { SpeechifyVoice } from '@mastra/voice-speechify';

const voice = new SpeechifyVoice({
  speechModel: { name: 'simba-3.2' },
  speaker: 'harper_32',
});

const { text } = await agent.generate(userInput);
const audioStream = await voice.speak(text);
```

`simba-3.2` is Speechify's latest streaming-native model with lower latency and richer expressivity. It ships with a curated set of voices — `beatrice_32`, `dominic_32`, `edmund_32`, `geffen_32`, `harper_32`, `hugh_32`, `imogen_32`, `wyatt_32` — exported from the package as `SIMBA_3_VOICES`. Passing a classic voice with `simba-3.2` will fail at the API; stick to the curated list, or omit `speaker` and let the plugin fall back to `harper_32` for you. Browse voices at [platform.speechify.ai](https://platform.speechify.ai).

## Extending it: full voice loop with Deepgram STT

Speechify is TTS-only — `SpeechifyVoice.listen()` throws by design. For a two-way voice loop, wire an STT provider (e.g. Deepgram) alongside it:

```ts
import { DeepgramVoice } from '@mastra/voice-deepgram';
import { SpeechifyVoice } from '@mastra/voice-speechify';

const stt = new DeepgramVoice({ listeningModel: { name: 'nova-3' } });
const tts = new SpeechifyVoice({ speechModel: { name: 'simba-3.2' }, speaker: 'harper_32' });

const transcript = await stt.listen(micStream);
const { text } = await agent.generate(transcript);
const audio = await tts.speak(text);
```

You can also wrap the two in Mastra's `CompositeVoice` and attach it to the agent (`agent.voice`); the demo keeps them at the call site so the composition stays explicit.

## Version pin

The pinned `@mastra/voice-speechify@0.14.0-alpha.0` is the first release to expose `simba-3.2` / `simba-3.0` in the model union and the curated `SIMBA_3_VOICES` list. Once `0.14.0` ships stable, you can drop the alpha suffix.
