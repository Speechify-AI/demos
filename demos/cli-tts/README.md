# TTS from the terminal with Speechify

A ~70-line command-line tool that turns text into spoken audio with the Speechify API and writes it to a file. Pairs with the post *Text-to-speech from your terminal: a CLI demo with the Speechify API*.

## What you get

- A CLI you run from your shell: `tts "Hello from the terminal"` writes an MP3.
- Text from an argument, trailing args, or piped `stdin`.
- Flags for voice, model, audio format, and output path.
- The billable character count logged by the API.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
npm install
npm start -- "Hello from the terminal"
# or pipe text in
echo "Read this aloud" | npm start
```

Other examples:

```bash
npm start -- -v rivera_33 -o voice.mp3 "Status update"
npm start -- -f ogg -o out.ogg "This one is OGG"
```

The command exits non-zero on a missing key or an API error, printing the message.

## How it works

`npm start` runs [`src/index.ts`](./src/index.ts) with [tsx](https://github.com/tsx-dot-js/tsx). It parses the arguments, reads `SPEECHIFY_API_KEY` from `.env`, and calls the Speechify API once:

```ts
const client = new SpeechifyClient({ token });
const response = await client.audio.speech({
  input: text,
  voice_id: "geffen_32",
  audio_format: "mp3",
  model: "simba-3.2",
});
fs.writeFileSync(out, Buffer.from(response.audio_data, "base64"));
```

The key never leaves your machine — there is no server and no browser surface, so everything stays local.

## Where the code came from

Built on the [`@speechify/api`](https://www.npmjs.com/package/@speechify/api) SDK's `audio.speech` method, the same call the other TypeScript demos use. The full SDK reference is at [docs.speechify.ai](https://docs.speechify.ai).

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
