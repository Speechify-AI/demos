# Speechify Demos

Worked examples that pair with the technical posts on [speechify.ai/blog](https://speechify.ai/blog). Each folder is self-contained: copy the folder, follow its README, run it.

## Demos

Demos with a **Live** link run in your browser at [demos.speechify.ai](https://demos.speechify.ai); the rest are clone-and-run.

<!-- DEMOS:START -->
| Folder | Stack | Live | What it does |
| --- | --- | --- | --- |
| [`next-voice-cloning-app/`](./next-voice-cloning-app) | Next.js | [Open](https://demos.speechify.ai/next-voice-cloning-app) | Upload a sample, clone the voice, synthesize with the clone. The API key stays server-side in route handlers. |
| [`captions-speech-marks/`](./captions-speech-marks) | TypeScript (native) |  | Synthesizes audio and builds a WebVTT caption file from the speech marks the API returns in the same response. Karaoke-highlight HTML demo included. |
| [`voice-cloning-narration/`](./voice-cloning-narration) | TypeScript (native) |  | Clones a voice from a 10-30 sec WAV sample, synthesizes with the new voice, deletes the clone. End-to-end lifecycle. |
| [`audiobook-pipeline/`](./audiobook-pipeline) | Python (SDK) |  | Chunks long-form text on sentence boundaries, synthesizes each chunk via the Speechify Python SDK, concatenates the MP3s with ffmpeg. |
| [`livekit-agent-speechify-python/`](./livekit-agent-speechify-python) | Python (LiveKit) |  | Real-time voice assistant using LiveKit's official livekit-plugins-speechify package for TTS, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession. |
| [`livekit-voice-agent-python/`](./livekit-voice-agent-python) | Python (LiveKit) |  | Legacy Speechify-owned LiveKit TTS demo, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession. Prefer the official LiveKit plugin demo for new work. |
| [`livekit-voice-agent-node/`](./livekit-voice-agent-node) | TypeScript (LiveKit) |  | Legacy Speechify-owned LiveKit TTS demo, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession. |
| [`ssml-emotion-tts/`](./ssml-emotion-tts) | TypeScript (SDK) |  | Drives emotion, pauses, prosody, emphasis, and pronunciation with SSML in a single POST /v1/audio/speech request. |
| [`web-audio-streaming/`](./web-audio-streaming) | TypeScript (browser) |  | Streams Speechify PCM into the browser Web Audio API for low-latency playback, behind a zero-dep proxy that keeps the key server-side. |
| [`deepgram-voice-agent-shim/`](./deepgram-voice-agent-shim) | Go shim + Node |  | Points Deepgram Voice Agent at the tts-shims OpenAI-compatible proxy so it speaks with a Speechify voice, key held server-side. |
| [`vapi-custom-voice/`](./vapi-custom-voice) | Go shim |  | Points Vapi custom voice at the tts-shims Vapi-compatible proxy so it speaks with Speechify raw PCM, key held server-side. |
| [`pipecat-agent-speechify/`](./pipecat-agent-speechify) | Python (Pipecat) |  | Real-time voice pipeline using Pipecat with Deepgram STT, Anthropic Claude, and Speechify TTS through SpeechifyTTSService. |
<!-- DEMOS:END -->

## Get an API key

Every demo needs `SPEECHIFY_API_KEY`. Grab one at [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys). Copy `.env.example` to `.env` inside the folder you want to run and paste the key in.

## Contributing

Want to add a demo? See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
