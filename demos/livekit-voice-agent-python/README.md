# LiveKit voice agent (Python)

A minimal [LiveKit Agents](https://docs.livekit.io/agents/) voice assistant that speaks with Speechify text-to-speech through LiveKit's official [`livekit-plugins-speechify`](https://pypi.org/project/livekit-plugins-speechify/) plugin.

The agent wires three pieces into an `AgentSession`: Deepgram for speech-to-text, OpenAI for the LLM, and **Speechify for text-to-speech** (voice-activity detection is bundled by default). Swapping the TTS is a one-line change, `tts=speechify.TTS(...)`, because the plugin implements LiveKit's standard `tts.TTS` interface. The agent greets you with `session.say(...)`, so the first thing you hear is Speechify reading a fixed line, before the LLM is involved.

## What you get

- `agent.py`: the full agent, STT + LLM + VAD + Speechify TTS in one `AgentSession`
- `requirements.txt`: LiveKit Agents plus the official Speechify, Deepgram and OpenAI plugins

## Run it

```bash
cp .env.example .env              # paste your keys
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py console           # talk to the agent in your terminal
```

Equivalent with [uv](https://docs.astral.sh/uv/):

```bash
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python agent.py console
```

`console` runs the agent locally against your microphone and speakers, so no LiveKit room is required. To serve it to a real room instead, use `python agent.py dev` (development) or `python agent.py start` (production), which need the `LIVEKIT_*` variables in `.env`.

On LiveKit Agents 1.8 these in-script commands still work, but print a deprecation notice pointing at the [LiveKit CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/) (`lk agent console`, `lk agent dev`) as their replacement.

## The Speechify bit

```python
from livekit.plugins import speechify

tts = speechify.TTS(voice_id="dominic_32", model="simba-3.2")
```

The plugin reads `SPEECHIFY_API_KEY` from the environment unless you pass `api_key=` directly. In the session it streams audio sentence by sentence and emits word-level timestamps (`aligned_transcript`), so LiveKit can render synced captions as the agent speaks. `simba-3.2` is the lowest-latency streaming-native model and is English only; the voice must support the chosen model (see the `/v1/voices` endpoint). Browse voices at [platform.speechify.ai](https://platform.speechify.ai).

## Prerequisites

- Python 3.10 or newer.
- `SPEECHIFY_API_KEY` for Speechify TTS.
- `DEEPGRAM_API_KEY` for speech-to-text and `OPENAI_API_KEY` for the LLM.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` only for `dev` or `start` against a LiveKit room.
- `console` mode needs a microphone, speakers and the PortAudio library. It ships with the macOS and Windows wheels; on Debian or Ubuntu install `libportaudio2`.
