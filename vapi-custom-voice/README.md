# Vapi custom voice + Speechify TTS

Runs the open-source [`tts-shims`](https://github.com/Speechify-AI/tts-shims) Vapi custom-voice proxy locally, sends Vapi's exact `voice-request` body to it, and verifies that raw PCM comes back from Speechify. This is the endpoint you point Vapi's `custom-voice` provider at when you want a Vapi assistant to speak with a Speechify voice.

Vapi's custom TTS integration is not OpenAI-shaped. It sends `POST` requests with a nested `message` object, a `message.type` discriminator of `voice-request`, and `message.text` plus `message.sampleRate`. It expects raw mono 16-bit signed little-endian PCM in the response, with `Content-Type: application/octet-stream`, not MP3 and not a WAV container. That is why this demo uses the `vapi` shim provider rather than one of the existing OpenAI, Deepgram, ElevenLabs, or Cartesia providers.

## What you get

- `run.sh` checks out a pinned `Speechify-AI/tts-shims` revision into an ignored `.shim/` directory, builds the `vapi` binary, starts it, checks `/healthz`, and runs a curl smoke test against `POST /synthesize` using Vapi's request shape.
- `.env.example` lists the values used by this demo. `SPEECHIFY_API_KEY` is required for the shim smoke test. `VAPI_SECRET` is optional locally, but mirrors the `server.secret` Vapi sends as `X-VAPI-SECRET`.
- The script proves the response is real PCM by wrapping the raw bytes to WAV with `ffmpeg`, then checking duration, sample count, nonzero samples, and peak amplitude.
- This folder does not vendor the shim source. It links to the upstream repo and clones it at run time.

## Run it

```bash
cp .env.example .env
# paste SPEECHIFY_API_KEY into .env
./run.sh
```

The verified run for this demo printed:

```text
health 200
synthesize 200 165600 bytes application/octet-stream
duration=3.450000
size=165678
samples=82800 nonzero=81634 peak=21631
```

That is a local proof of the webhook contract. You do not need a Vapi account for this smoke test because it sends the same JSON shape Vapi sends to the shim. A live Vapi phone call still requires a Vapi assistant, a public HTTPS URL for the shim, and the normal Vapi account setup.

## The Speechify bit

The Vapi-compatible shim is a small Go binary:

```bash
git clone https://github.com/Speechify-AI/tts-shims
cd tts-shims
make vapi
SHIM_ADDR=:8772 SPEECHIFY_API_KEY="$SPEECHIFY_API_KEY" SHIM_DEFAULT_MODEL=simba-3.2 ./bin/vapi
```

It listens on `POST /synthesize` and answers the request shape Vapi sends:

```bash
curl -o shim-smoke.pcm \
  -w "%{http_code} %{size_download} %{content_type}\n" \
  -X POST "http://localhost:8772/synthesize" \
  -H "Content-Type: application/json" \
  -H "X-VAPI-SECRET: local-smoke-secret" \
  -d '{"message":{"type":"voice-request","text":"Vapi custom voice, now speaking with Speechify.","sampleRate":24000,"timestamp":1720000000000,"call":{},"assistant":{}}}'
```

When `SPEECHIFY_API_KEY` is set in the shim process, Vapi's `X-VAPI-SECRET` stays a client-to-shim secret. It is not forwarded to Speechify. The shim calls `POST /v1/audio/stream` with `voice_id: "geffen_32"`, `model: "simba-3.2"`, and `output_format: "pcm_24000"`, then streams the raw PCM bytes back to Vapi.

## Wiring it into Vapi

In Vapi, configure the assistant voice as `custom-voice` and point `voice.server.url` at your deployed shim. Use a public HTTPS URL in production.

```json
{
  "voice": {
    "provider": "custom-voice",
    "server": {
      "url": "https://your-shim-host.example/synthesize",
      "secret": "replace_with_a_random_secret"
    },
    "timeoutSeconds": 30
  }
}
```

Vapi will send the secret as `X-VAPI-SECRET`. If you prefer Vapi's custom credentials path, configure the equivalent header there instead. The important piece is the URL: it should include `/synthesize`, because that is the route the `vapi` shim serves.

## Sample rate

Vapi's custom TTS request includes `message.sampleRate`, and the response must match it exactly. This demo sets `VAPI_SAMPLE_RATE=24000` because the Speechify PCM stream path used here is verified at 24 kHz. Keep Vapi on 24 kHz for the copy-paste path. If you want to accept 8 kHz, 16 kHz, or 22.05 kHz in production, verify that full path with your deployed shim before you put callers on it.

## Prerequisites

- Go 1.26 or newer, or Docker if you adapt the script to build the shim image (`docker build --build-arg PROVIDER=vapi`).
- `curl`, `ffmpeg`, `ffprobe`, and `python3` for the smoke test and PCM proof.
- A synth-capable `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

If Go's HTTP client on your machine cannot verify the Speechify API certificate, set `SSL_CERT_FILE=/etc/ssl/cert.pem` before running the shim. The script does this automatically when that file exists and `SSL_CERT_FILE` is not already set.
