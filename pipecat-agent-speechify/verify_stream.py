import json
import os
import ssl
import urllib.error
import urllib.request
import wave

from dotenv import load_dotenv


SAMPLE_RATE = 24_000
DEFAULT_BASE_URL = "https://api.speechify.ai/v1"


def main() -> None:
    load_dotenv()

    api_key = os.environ.get("SPEECHIFY_API_KEY")
    if not api_key:
        raise SystemExit("Set SPEECHIFY_API_KEY, or copy .env.example to .env and fill it in.")

    base_url = os.environ.get("SPEECHIFY_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    voice_id = os.environ.get("SPEECHIFY_VOICE_ID", "jack")
    model = os.environ.get("SPEECHIFY_MODEL", "simba-english")

    payload = json.dumps(
        {
            "input": "Speechify is streaming raw PCM into a Pipecat voice pipeline.",
            "voice_id": voice_id,
            "model": model,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{base_url}/audio/stream",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "audio/pcm",
        },
    )

    context = ssl.create_default_context()
    cert_file = os.environ.get("SSL_CERT_FILE")
    if cert_file:
        context.load_verify_locations(cert_file)

    try:
        with urllib.request.urlopen(request, context=context, timeout=60) as response:
            pcm = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Speechify returned HTTP {exc.code}: {body}") from exc

    output = "speechify-stream.wav"
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)

    print(f"wrote {output} from {len(pcm)} bytes of 24 kHz mono PCM")


if __name__ == "__main__":
    main()
