# Speechify Demos

Worked examples that pair with the technical posts on [speechify.ai/blog](https://speechify.ai/blog). Each folder is self-contained: copy the folder, follow its README, run it.

## Demos

| Folder | Stack | What it does |
| --- | --- | --- |
| [`captions-speech-marks/`](./captions-speech-marks) | TypeScript (native) | Synthesizes audio + builds a WebVTT caption file from the speech marks the API returns in the same response. Karaoke-highlight HTML demo included. |
| [`voice-cloning-narration/`](./voice-cloning-narration) | TypeScript (native) | Clones a voice from a 10-30 sec WAV sample, synthesizes with the new voice, deletes the clone. End-to-end lifecycle. |
| [`audiobook-pipeline/`](./audiobook-pipeline) | Python (SDK) | Chunks long-form text on sentence boundaries, synthesizes each chunk via the Speechify Python SDK, concatenates the MP3s with ffmpeg. |

## Get an API key

Every demo needs `SPEECHIFY_API_KEY`. Grab one at [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys). Copy `.env.example` to `.env` inside the folder you want to run and paste the key in.

## License

[MIT](./LICENSE)
