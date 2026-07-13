# LiveKit voice agent with Speechify TTS (Python)

A minimal LiveKit Agents voice assistant that uses LiveKit's official [`livekit-plugins-speechify`](https://pypi.org/project/livekit-plugins-speechify/) package for text-to-speech.

The agent wires Deepgram STT, an OpenAI LLM, and Speechify TTS into one `AgentSession`. The Speechify-specific part is one constructor call:

```python
tts=speechify.TTS(voice_id="dominic_32", model="simba-3.2")
```

## What you get

- `agent.py` builds the LiveKit `AgentSession` with Deepgram STT, OpenAI LLM, and Speechify TTS.
- `smoke_synthesize.py` runs Speechify TTS through the LiveKit plugin without a LiveKit room and writes a local WAV file.
- `requirements.txt` installs LiveKit Agents, the official Speechify plugin, and the Deepgram/OpenAI plugins used by the agent.
- `.env.example` lists every environment variable used by the demo.

## Run it

```bash
cp .env.example .env
# paste your keys into .env

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the headless Speechify smoke test first:

```bash
python smoke_synthesize.py
```

It writes `speechify-tts-smoke.wav` using the same `speechify.TTS(...)` object that the agent uses.

Then run the agent locally in console mode:

```bash
python agent.py console
```

`console` mode talks to your microphone and speakers from the terminal, so it does not need a LiveKit room. To serve the agent to a real LiveKit room, run `python agent.py dev` during development or `python agent.py start` in production with `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` set.

## The Speechify bit

```python
from livekit.plugins import speechify

tts = speechify.TTS(voice_id="dominic_32", model="simba-3.2")
```

`livekit-plugins-speechify` reads `SPEECHIFY_API_KEY` from the environment unless you pass `token=` directly. The demo keeps the key in `.env` and loads it with `python-dotenv`.

This demo passes `dominic_32` and `simba-3.2` explicitly so the voice and model pairing is visible in the code. If you pick another voice, use one whose model list includes `simba-3.2`.

## Prerequisites

- Python 3.10 or newer.
- `SPEECHIFY_API_KEY` for Speechify TTS.
- `DEEPGRAM_API_KEY` for speech-to-text.
- `OPENAI_API_KEY` for the LLM.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` only when you run against a LiveKit room with `dev` or `start` mode.

If Python cannot verify TLS certificates on your machine, set `SSL_CERT_FILE` to your system certificate bundle or the `certifi` bundle before running the smoke test.
