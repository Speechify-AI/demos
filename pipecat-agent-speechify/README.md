# Pipecat voice agent + Speechify TTS

A minimal [Pipecat](https://docs.pipecat.ai) voice agent that listens with Deepgram STT, thinks with Anthropic Claude, and speaks with Speechify TTS through `SpeechifyTTSService`.

The pipeline shape is:

```text
transport.input() -> Deepgram STT -> Anthropic LLM -> SpeechifyTTSService -> transport.output()
```

## What you get

- `agent.py`, a Pipecat voice pipeline using `SpeechifyTTSService` for text-to-speech.
- `verify_stream.py`, a small Speechify stream smoke test that writes 24 kHz mono PCM to `speechify-stream.wav`.
- `.env.example`, listing the Speechify, Deepgram, Anthropic, and optional Daily keys.
- `requirements.txt`, pinned to the current Pipecat release while the Speechify extra is waiting for publication.

## Run the Speechify stream check

This does not start a voice room. It only proves your `SPEECHIFY_API_KEY`, voice, model, and Speechify stream endpoint work.

```bash
cp .env.example .env
# paste SPEECHIFY_API_KEY into .env
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python verify_stream.py
```

A successful run prints the byte count and writes `speechify-stream.wav`:

```text
wrote speechify-stream.wav from 24896 bytes of 24 kHz mono PCM
```

If Python cannot verify the Speechify API certificate on your machine, set `SSL_CERT_FILE=/etc/ssl/cert.pem` before running the script.

## Run the voice agent

The full agent needs a transport plus STT and LLM keys. The simplest local path is Pipecat's WebRTC runner:

```bash
cp .env.example .env
# fill SPEECHIFY_API_KEY, DEEPGRAM_API_KEY, and ANTHROPIC_API_KEY
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py --transport webrtc
```

To use a Daily room instead, add `DAILY_API_KEY` and run:

```bash
python agent.py --transport daily
```

## The Speechify bit

The TTS swap is the `SpeechifyTTSService` in the middle of the pipeline:

```python
from pipecat.services.speechify.tts import SpeechifyTTSService

tts = SpeechifyTTSService(
    api_key=os.environ["SPEECHIFY_API_KEY"],
    base_url=os.environ.get("SPEECHIFY_BASE_URL", "https://api.speechify.ai/v1"),
    settings=SpeechifyTTSService.Settings(
        voice=os.environ.get("SPEECHIFY_VOICE_ID", "jack"),
        model=os.environ.get("SPEECHIFY_MODEL", "simba-english"),
        loudness_normalization=True,
        text_normalization=True,
    ),
)
```

`SpeechifyTTSService` calls `POST /v1/audio/stream` with `Accept: audio/pcm`. Speechify returns headerless 16-bit PCM, 24 kHz mono, and the service yields Pipecat `TTSAudioRawFrame` chunks that the selected transport can send back to the listener.

## Prerequisites

- Python 3.11 or newer.
- A synth-capable `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).
- `DEEPGRAM_API_KEY` for speech-to-text.
- `ANTHROPIC_API_KEY` for the LLM.
- `DAILY_API_KEY` only if you run the Daily transport.

## Publish note

This demo expects the Speechify TTS service to be available from `pipecat-ai` as `from pipecat.services.speechify.tts import SpeechifyTTSService`. Once the Speechify extra lands in a released Pipecat package, update `requirements.txt` to `pipecat-ai[speechify,daily,webrtc,deepgram,anthropic]==1.5.0` or the current release version.
