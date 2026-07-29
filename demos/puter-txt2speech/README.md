# Speechify TTS in Puter

One static HTML page that speaks with a Speechify Simba 3.2 voice through [Puter](https://puter.com)'s `puter.ai.txt2speech()` — no Speechify API key, no backend, no build step.

## What you get

- `puter.ai.txt2speech(text, { provider: 'speechify', ... })` from a plain `<script>` tag
- A voice picker for the five Simba 3.2 voices the driver registers (`geffen_32` default)
- A test-mode toggle that returns sample audio without spending credits
- Puter's User-Pays model in action: the signed-in Puter user pays for synthesis, so the page ships no credentials at all

## Run it yourself

```bash
cd demos/puter-txt2speech
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works (or just open `index.html` directly). Click **Speak** — Puter prompts you to sign in or create a free account on the first call, then the audio plays.

## Prerequisites

- A [Puter account](https://puter.com) (free tier is fine; the first call prompts sign-in)
- A Puter deployment that includes the Speechify TTS driver, merged upstream in July 2026 ([HeyPuter/puter#3453](https://github.com/HeyPuter/puter/pull/3453)). An unknown-provider error means the instance predates it.

No `SPEECHIFY_API_KEY` needed — that's the point of this one. Puter's backend holds the credentials and meters usage per Puter user.

## Where the code came from

- [`puter.ai.txt2speech()` reference](https://docs.puter.com/AI/txt2speech/)
- The Speechify driver source in [HeyPuter/puter](https://github.com/HeyPuter/puter/tree/main/src/backend/drivers/ai-tts/providers/speechify)
- [Speechify TTS models](https://docs.speechify.ai/build/guides/concepts/models)
