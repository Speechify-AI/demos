# Deepgram Voice Agent + Speechify TTS

Runs the open-source [`tts-shims`](https://github.com/Speechify-AI/tts-shims) OpenAI-compatible proxy locally, points an OpenAI-style speak request at it, and verifies the audio comes back from Speechify. This is the endpoint you point Deepgram Voice Agent at to make it speak with a Speechify voice.

Deepgram Voice Agent uses `provider.type: "open_ai"` with an `endpoint.url` for bring-your-own third-party TTS. When you do that, Deepgram sends an OpenAI-shaped request (`POST /v1/audio/speech` with `{ model, input, voice }` and `Authorization: Bearer`) to that URL. The shim answers on that exact contract, holds `SPEECHIFY_API_KEY` on the server, and returns audio synthesized by Speechify.

## What you get

- `run.sh` checks out a pinned `Speechify-AI/tts-shims` revision into an ignored `.shim/` directory, builds the `openai` binary, starts it, checks `/healthz`, and runs a curl smoke test against `POST /v1/audio/speech`.
- `.env.example` lists the keys used by this demo. `SPEECHIFY_API_KEY` is required for the shim smoke test. `DEEPGRAM_API_KEY` is included for wiring the same shim into a live Deepgram Voice Agent.
- This folder does not vendor the shim source. It links to the upstream repo and clones it at run time.

## Run it

```bash
cp .env.example .env
# paste SPEECHIFY_API_KEY into .env
./run.sh
```

The successful smoke test prints a `200` and the downloaded byte count, then writes the audio to `shim-smoke.mp3`:

```text
health 200
speak 200 54188 bytes
audio saved to .../shim-smoke.mp3
```

## The Speechify bit

The OpenAI-compatible shim is a small Go binary:

```bash
git clone https://github.com/Speechify-AI/tts-shims
cd tts-shims
make openai
SHIM_ADDR=:8771 SPEECHIFY_API_KEY="$SPEECHIFY_API_KEY" ./bin/openai
```

It listens on OpenAI's speech route and answers the same request shape Deepgram sends:

```bash
curl -o shim-smoke.mp3 \
  -w "%{http_code} %{size_download}\n" \
  -X POST "http://localhost:8771/v1/audio/speech" \
  -H "Authorization: Bearer placeholder-ignored-by-shim" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"Deepgram voice agent, now speaking with Speechify.","voice":"alloy","response_format":"mp3"}'
```

When `SPEECHIFY_API_KEY` is set in the shim process, the placeholder Bearer token is ignored. The shim uses its own server-side key to call Speechify. The shim aliases OpenAI model and voice names onto Speechify equivalents (`tts-1` maps to `simba-english`, `alloy` and the other OpenAI voice names map to `george`), so the standard OpenAI request Deepgram sends works without changes.

## Wiring it into Deepgram Voice Agent

In your Deepgram Voice Agent `Settings` message, configure the third-party TTS provider as `open_ai` and point `endpoint.url` at the deployed shim. Deepgram then sends its OpenAI-shaped speak requests to the shim.

```json
{
  "type": "Settings",
  "audio": {
    "output": { "encoding": "linear16", "sample_rate": 24000 }
  },
  "agent": {
    "speak": {
      "provider": {
        "type": "open_ai",
        "model": "simba-3.2",
        "voice": "geffen_32"
      },
      "endpoint": {
        "url": "https://your-shim-host.example/v1/audio/speech",
        "headers": {
          "authorization": "Bearer placeholder-ignored-by-shim"
        }
      }
    }
  }
}
```

Two things matter here. First, pick a real Speechify model and voice. The shim maps the OpenAI defaults (`tts-1`, `alloy`) onto `simba-english` + `george`, which is fine but not the best Speechify has. Because the shim passes any name it does not recognise straight through, sending `model: "simba-3.2"` and `voice: "geffen_32"` (a Simba 3.2 voice) gives you the current top-quality output instead. Browse voices with `GET /v1/voices`; any voice whose `models` list includes `simba-3.2` works.

Second, the `audio.output` block is required. The `open_ai` speak provider needs uncontainerized 24 kHz `linear16` output. Send `container: "wav"` or a different sample rate and Deepgram rejects the session with `INVALID_SETTINGS` before a single word is spoken.

Use Deepgram's docs for the full Voice Agent settings shape:

- [Configure Voice Agent](https://developers.deepgram.com/docs/configure-voice-agent)
- [Voice Agent TTS models](https://developers.deepgram.com/docs/voice-agent-tts-models)

## Prove it end to end with a live agent

`run.sh` proves the shim answers Deepgram's request shape. `agent.js` proves a real Deepgram Voice Agent actually calls the shim when it speaks.

Deepgram calls your `endpoint.url` from its own cloud, so the shim has to be reachable on a public URL. Expose the local shim with a tunnel:

```bash
# terminal 1: run the shim (see "Run it" above), then tunnel it
ngrok http 8771

# terminal 2: point the agent at the tunnel and run it
npm install
SHIM_URL="https://<your-ngrok-subdomain>.ngrok-free.dev" \
  DEEPGRAM_API_KEY="$DEEPGRAM_API_KEY" \
  npm run agent
```

`agent.js` opens a Voice Agent session, streams a sample WAV as the user's speech, and configures `speak` to point at the shim. When the agent speaks, Deepgram sends `POST /v1/audio/speech` to the tunnel, the shim answers with Speechify audio, and the agent writes it to `agent-output-0.wav`. In the verified run for this demo, ngrok's request inspector (`http://localhost:4040`) showed the inbound `POST /v1/audio/speech` arriving from a Deepgram cloud IP with the placeholder Bearer token, returning `200`, and the agent saved 123,840 bytes of real (non-silent) speech.

## Prerequisites

- Go 1.26 or newer, or Docker if you adapt the script to build the shim image (`docker build --build-arg PROVIDER=openai`).
- A synth-capable `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).
- A `DEEPGRAM_API_KEY` if you wire the deployed shim into a live Deepgram Voice Agent.

If Go's HTTP client on your machine cannot verify the Speechify API certificate, set `SSL_CERT_FILE=/etc/ssl/cert.pem` before running the shim. The script does this automatically when that file exists and `SSL_CERT_FILE` is not already set.
