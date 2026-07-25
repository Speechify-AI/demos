#!/usr/bin/env python3
"""Smoke test: synthesize speech with Speechify TTS and write a WAV file.

Unlike the full agent, this does not join a Stream call - it just drives
`speechify.TTS` directly so you can confirm the API key works and listen to
the result.

Usage::
    python smoke_synthesize.py
    python smoke_synthesize.py "Some other text to speak"

Requires SPEECHIFY_API_KEY (see `.env.example`). The output is written to
`speechify-tts-smoke.wav` (24 kHz, mono, 16-bit PCM).
"""

import asyncio
import sys
import wave

from dotenv import load_dotenv
from vision_agents.plugins import speechify
from vision_agents.plugins.speechify.tts import SAMPLE_RATE

load_dotenv()

OUTPUT_PATH = "speechify-tts-smoke.wav"


async def main() -> None:
    text = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Hello from Speechify TTS on Vision Agents."
    )

    tts = speechify.TTS(voice_id="geffen_32", model="simba-3.2")
    pcm = bytearray()
    chunks = 0
    async for chunk in tts.send_iter(text):
        if chunk.data is not None:
            pcm += chunk.data.samples.tobytes()
            chunks += 1

    with wave.open(OUTPUT_PATH, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)

    duration = len(pcm) / 2 / SAMPLE_RATE
    print(f"chunks: {chunks}, duration: {duration:.2f}s -> {OUTPUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
