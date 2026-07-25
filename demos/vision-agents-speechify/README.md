# Vision Agents voice bot with Speechify TTS (Python)

A minimal [GetStream Vision Agents](https://visionagents.ai) voice bot that uses GetStream's official [`vision-agents-plugins-speechify`](https://github.com/GetStream/Vision-Agents/tree/main/plugins/speechify) package for text-to-speech.

The bot wires Deepgram STT, a Gemini LLM, and Speechify TTS into one `Agent`. The Speechify-specific part is one constructor call:

```python
tts=speechify.TTS(voice_id="geffen_32", model="simba-3.2")
```

## What you get

- `agent.py` builds the Vision Agents `Agent` with Deepgram STT, Gemini LLM, and Speechify TTS, and joins a GetStream (Stream) video call.
- `smoke_synthesize.py` runs Speechify TTS through the Vision Agents plugin without joining a call and writes a local WAV file.
- `requirements.txt` installs Vision Agents (with the `speechify` extra) and the GetStream/Deepgram/Gemini plugins used by the bot.
- `.env.example` lists every environment variable used by the demo.

## Run it

```bash
cp .env.example .env
# paste your keys into .env

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> **Note:** `vision-agents-plugins-speechify` is GetStream's plugin, published from [github.com/GetStream/Vision-Agents](https://github.com/GetStream/Vision-Agents/tree/main/plugins/speechify). If `pip install -r requirements.txt` can't find it on PyPI yet, install it straight from the source repo instead:
> ```bash
> pip install "git+https://github.com/GetStream/Vision-Agents.git#subdirectory=plugins/speechify"
> ```

Run the headless Speechify smoke test first:

```bash
python smoke_synthesize.py
```

It writes `speechify-tts-smoke.wav` using the same `speechify.TTS(...)` object the agent uses.

Then run the full bot:

```bash
python agent.py run
```

This creates (or joins) a Stream call and starts the bot. Open the call in a browser with the Stream call details Vision Agents logs on startup, and speak into your microphone — the bot should answer out loud. Use `python agent.py serve` instead to host the bot behind a small FastAPI server that a client app can start/stop sessions against.

## The Speechify bit

```python
from vision_agents.plugins import speechify

tts = speechify.TTS(voice_id="geffen_32", model="simba-3.2")
```

`vision-agents-plugins-speechify` reads `SPEECHIFY_API_KEY` from the environment unless you pass `api_key=` directly. The demo keeps the key in `.env` and loads it with `python-dotenv`.

This demo passes `geffen_32` and `simba-3.2` explicitly — they're also the plugin's defaults — so the voice and model pairing is visible in the code. If you pick another voice, use one of the 8 registered `simba-3.2` voices.

## Where the code came from

Adapted from GetStream's own [Speechify plugin example](https://github.com/GetStream/Vision-Agents/tree/main/plugins/speechify/example) (`main.py` and `tts_smoke.py`), trimmed to the minimum needed to demo the Speechify integration.

## Prerequisites

- Python 3.10 or newer.
- `SPEECHIFY_API_KEY` for Speechify TTS.
- `STREAM_API_KEY` / `STREAM_API_SECRET` for the GetStream video/audio edge — get these from the [Stream Dashboard](https://getstream.io/try-for-free/).
- `DEEPGRAM_API_KEY` for speech-to-text.
- `GOOGLE_API_KEY` for the Gemini LLM.

If Python cannot verify TLS certificates on your machine, set `SSL_CERT_FILE` to your system certificate bundle or the `certifi` bundle before running the smoke test.
