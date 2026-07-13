from __future__ import annotations

import asyncio
import wave

from dotenv import load_dotenv
from livekit.agents.utils import http_context
from livekit.plugins import speechify

OUTPUT_FILE = "speechify-tts-smoke.wav"
SAMPLE_WIDTH_BYTES = 2


async def main() -> None:
    load_dotenv()
    frames = []

    async with http_context.open():
        tts = speechify.TTS(voice_id="dominic_32", model="simba-3.2", encoding="mp3_24000")
        async for event in tts.synthesize(
            "Hello from the official LiveKit Speechify plugin. This is a headless smoke test."
        ):
            frames.append(event.frame)

    with wave.open(OUTPUT_FILE, "wb") as audio:
        audio.setnchannels(tts.num_channels)
        audio.setsampwidth(SAMPLE_WIDTH_BYTES)
        audio.setframerate(tts.sample_rate)
        for frame in frames:
            audio.writeframes(bytes(frame.data))

    duration = sum(frame.samples_per_channel for frame in frames) / tts.sample_rate
    print(f"wrote {OUTPUT_FILE} ({duration:.2f}s, {len(frames)} frame{'s' if len(frames) != 1 else ''})")


if __name__ == "__main__":
    asyncio.run(main())
