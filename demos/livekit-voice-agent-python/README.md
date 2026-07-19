# LiveKit voice agent (Python)

A minimal [LiveKit Agents](https://docs.livekit.io/agents/) voice assistant that speaks with Speechify text-to-speech via the [`speechify-livekit`](https://pypi.org/project/speechify-livekit/) plugin.

The agent wires three pieces into an `AgentSession`: Deepgram for speech-to-text, OpenAI for the LLM, and **Speechify for text-to-speech** (voice-activity detection is bundled by default). Swapping the TTS is a one-line change — `tts=speechify.TTS(...)` — because the plugin implements LiveKit's standard `tts.TTS` interface.

## What you get

- `agent.py` — the full agent: STT + LLM + VAD + Speechify TTS in one `AgentSession`
- `requirements.txt` — pins `speechify-livekit` plus the LiveKit plugin extras

## Run it

```bash
cp .env.example .env              # paste your keys
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py download-files    # fetch bundled model files (VAD, etc.)
python agent.py console           # talk to the agent in your terminal
```

Equivalent with [uv](https://docs.astral.sh/uv/):

```bash
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python agent.py download-files
python agent.py console
```

`console` runs the agent locally against your microphone and speakers — no LiveKit room required. To serve it to a real room instead, use `python agent.py dev` (development) or `python agent.py start` (production), which need the `LIVEKIT_*` variables in `.env`.

## The Speechify bit

```python
from livekit.plugins import speechify

tts = speechify.TTS(voice_id="dominic_32", model="simba-3.2")
```

`speechify.TTS` streams audio and emits word-level timestamps (`aligned_transcript`), so LiveKit can render synced captions as the agent speaks. `simba-3.2` is the latest streaming-native model; the voice must support the chosen model (see the `/v1/voices` endpoint). Browse voices at [platform.speechify.ai](https://platform.speechify.ai).
