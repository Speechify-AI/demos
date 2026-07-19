window.__DEMOS__ = [
  {
    "slug": "next-voice-cloning-app",
    "title": "Voice cloning web app",
    "stack": "Next.js",
    "hosted": true,
    "blurb": "Upload a sample, clone the voice, synthesize with the clone. The API key stays server-side in route handlers."
  },
  {
    "slug": "captions-speech-marks",
    "title": "Captions from speech marks",
    "stack": "TypeScript (native)",
    "hosted": false,
    "blurb": "Synthesizes audio and builds a WebVTT caption file from the speech marks the API returns in the same response. Karaoke-highlight HTML demo included."
  },
  {
    "slug": "voice-cloning-narration",
    "title": "Voice cloning narration",
    "stack": "TypeScript (native)",
    "hosted": false,
    "blurb": "Clones a voice from a 10-30 sec WAV sample, synthesizes with the new voice, deletes the clone. End-to-end lifecycle."
  },
  {
    "slug": "audiobook-pipeline",
    "title": "Audiobook pipeline",
    "stack": "Python (SDK)",
    "hosted": false,
    "blurb": "Chunks long-form text on sentence boundaries, synthesizes each chunk via the Speechify Python SDK, concatenates the MP3s with ffmpeg."
  },
  {
    "slug": "livekit-agent-speechify-python",
    "title": "LiveKit agent (official plugin)",
    "stack": "Python (LiveKit)",
    "hosted": false,
    "blurb": "Real-time voice assistant using LiveKit's official livekit-plugins-speechify package for TTS, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession."
  },
  {
    "slug": "livekit-voice-agent-python",
    "title": "LiveKit voice agent",
    "stack": "Python (LiveKit)",
    "hosted": false,
    "blurb": "Legacy Speechify-owned LiveKit TTS demo, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession. Prefer the official LiveKit plugin demo for new work."
  },
  {
    "slug": "livekit-voice-agent-node",
    "title": "LiveKit voice agent",
    "stack": "TypeScript (LiveKit)",
    "hosted": false,
    "blurb": "Legacy Speechify-owned LiveKit TTS demo, with Deepgram STT and an OpenAI LLM in a LiveKit AgentSession."
  },
  {
    "slug": "ssml-emotion-tts",
    "title": "SSML emotion TTS",
    "stack": "TypeScript (SDK)",
    "hosted": false,
    "blurb": "Drives emotion, pauses, prosody, emphasis, and pronunciation with SSML in a single POST /v1/audio/speech request."
  },
  {
    "slug": "web-audio-streaming",
    "title": "Web audio streaming",
    "stack": "TypeScript (browser)",
    "hosted": false,
    "blurb": "Streams Speechify PCM into the browser Web Audio API for low-latency playback, behind a zero-dep proxy that keeps the key server-side."
  },
  {
    "slug": "deepgram-voice-agent-shim",
    "title": "Deepgram voice agent shim",
    "stack": "Go shim + Node",
    "hosted": false,
    "blurb": "Points Deepgram Voice Agent at the tts-shims OpenAI-compatible proxy so it speaks with a Speechify voice, key held server-side."
  },
  {
    "slug": "vapi-custom-voice",
    "title": "Vapi custom voice",
    "stack": "Go shim",
    "hosted": false,
    "blurb": "Points Vapi custom voice at the tts-shims Vapi-compatible proxy so it speaks with Speechify raw PCM, key held server-side."
  },
  {
    "slug": "pipecat-agent-speechify",
    "title": "Pipecat agent",
    "stack": "Python (Pipecat)",
    "hosted": false,
    "blurb": "Real-time voice pipeline using Pipecat with Deepgram STT, Anthropic Claude, and Speechify TTS through SpeechifyTTSService."
  }
];
