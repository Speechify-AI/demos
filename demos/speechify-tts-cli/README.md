# Text-to-speech CLI

Generate speech from your terminal with the Speechify API — pipe text or a file
in, get an MP3 out. Pairs with the Speechify post *"Text-to-speech from your
terminal: a CLI demo with the Speechify API"*.

## What you get

A single-file Node CLI that calls the Speechify API and writes the audio:

- reads text from `--text`, `--file`, or stdin
- pick the `--voice`, `--model`, and `--format`
- writes the audio to `--output` (or raw bytes to stdout to pipe downstream)

Login-free, zero prompt, drop it in a shell alias or a build step.

## Run it yourself

```bash
cp .env.example .env      # paste your key into .env
npm install

# from a string
npm start -- --text "Hello from your terminal" -o hello.mp3

# from a file
npm start -- --file chapter.txt -v lily --model simba-english -o chapter.mp3

# from stdin
cat notes.txt | npm start -- -o notes.mp3
```

Prerequisites: Node 20+, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Where the code came from

Uses the official `@speechify/api` client — the same `client.audio.speech()`
call used across the [demos repo](../). See the Speechify docs for voice ids and
available `audio_format` values.
