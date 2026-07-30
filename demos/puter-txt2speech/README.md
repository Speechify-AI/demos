# Speechify TTS in Puter

One static HTML page that speaks with a Speechify Simba 3.2 voice through [Puter](https://github.com/HeyPuter/puter)'s `puter.ai.txt2speech()`. Your Speechify API key is configured once on the Puter instance, server-side — the page itself ships no credentials, no backend, no build step.

## What you get

- `puter.ai.txt2speech(text, { provider: 'speechify', ... })` from a plain `<script>` tag
- A voice picker for the five Simba 3.2 voices the driver registers (`geffen_32` default)
- A test-mode toggle that returns sample audio without hitting the Speechify API
- The key stays in the Puter instance's server config; pages calling `txt2speech` never see it

## Run it yourself

1. Configure your Puter instance: set your Speechify API key ([platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)) as the `speechify` provider entry (`apiKey`) in the TTS driver's provider config, and restart. The instance registers the provider at boot — without a key, `provider: 'speechify'` is not available.
2. Serve the page:

```bash
cd demos/puter-txt2speech
python3 -m http.server 8000
# open http://localhost:8000/?puter.api_origin=<your instance's API origin>
```

`puter.js` reads the `puter.api_origin` query parameter at load time to target your instance (e.g. `http://api.puter.localhost:4100` for a default local self-host). Click **Speak** — Puter prompts you to sign in to the instance on the first call, then the audio plays.

## Prerequisites

- Speechify API key ([platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)), configured on the instance as above
- A [Puter instance](https://github.com/HeyPuter/puter) running a build that includes the Speechify TTS driver ([HeyPuter/puter#3453](https://github.com/HeyPuter/puter/pull/3453))
- A Puter account on that instance

## Where the code came from

- [`puter.ai.txt2speech()` reference](https://docs.puter.com/AI/txt2speech/)
- The Speechify driver source in [HeyPuter/puter](https://github.com/HeyPuter/puter/tree/main/src/backend/drivers/ai-tts/providers/speechify)
- [Speechify TTS models](https://docs.speechify.ai/build/guides/concepts/models)
