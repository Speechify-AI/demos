# LiveKit captions with Speechify word timestamps (Python)

A LiveKit Agents voice assistant that reads Speechify's **word-level timestamps**
as the agent speaks. It uses LiveKit's official
[`livekit-plugins-speechify`](https://pypi.org/project/livekit-plugins-speechify/)
package for TTS, with Deepgram STT and an OpenAI LLM in one `AgentSession`.

The Speechify-specific part is one constructor call plus one method override:

```python
tts=speechify.TTS(voice_id="dominic_32", model="simba-3.2")
```

```python
async def transcription_node(self, text, model_settings):
    async for chunk in text:
        if isinstance(chunk, TimedString) and isinstance(chunk.start_time, (int, float)) \
                and isinstance(chunk.end_time, (int, float)):
            logger.info("[%6.2f-%6.2f] %s", chunk.start_time, chunk.end_time, chunk)
        yield chunk
```

On the streaming-native models (`simba-3.0`, `simba-3.2`), the plugin streams
word-level speech marks alongside the audio and hands each word to
`transcription_node` as a `TimedString` carrying `start_time` and `end_time` in
seconds — no second API call and no separate alignment pass.

## What you get

- `agent.py` builds the LiveKit `AgentSession` (Deepgram STT, OpenAI LLM,
  Speechify TTS) and overrides `transcription_node` to log each word's timing.
- `requirements.txt` installs LiveKit Agents, the official Speechify plugin, and
  the Deepgram/OpenAI plugins used by the agent.
- `.env.example` lists every environment variable used by the demo.

## Run it

```bash
cp .env.example .env
# paste your keys into .env

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the agent locally in console mode:

```bash
python agent.py console
```

`console` mode talks to your microphone and speakers from the terminal, so it
does not need a LiveKit room. Say something and watch the logs — each spoken
word prints its window:

```text
[  0.00-  0.32] Hi
[  0.32-  0.51] there
[  0.63-  0.98] I'm
[  0.98-  1.44] powered
[  1.44-  1.62] by
[  1.62-  2.10] Speechify
```

To serve the agent to a real LiveKit room, run `python agent.py dev` during
development or `python agent.py start` in production with `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` set.

## Notes

- Word marks come from the streaming-native models only. `simba-3.0` and
  `simba-3.2` stream them; the legacy `simba-english` and `simba-multilingual`
  models return no marks.
- `TimedString` subclasses `str`, so anything that already treats the transcript
  as text keeps working — the timings are extra attributes on each chunk.
- Speechify marks intra-word punctuation as its own token, so `well-known`
  arrives as `well`, `-`, `known`. Stitch adjacent tokens by their times if you
  need whole words.
- `dominic_32` with `simba-3.2` is a clean pairing. If you pick another voice,
  use one whose model list includes `simba-3.2`.

## Prerequisites

- Python 3.10 or newer.
- `SPEECHIFY_API_KEY` for Speechify TTS.
- `DEEPGRAM_API_KEY` for speech-to-text.
- `OPENAI_API_KEY` for the LLM.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` only when you run
  against a LiveKit room with `dev` or `start` mode.

The plugin reads `SPEECHIFY_API_KEY` from the environment unless you pass
`api_key=` to `speechify.TTS(...)`. The demo keeps the key in `.env` and loads it
with `python-dotenv`.
