# TTS from your terminal (Next.js)

A terminal-styled web playground for Speechify text-to-speech. Type a command like `speechify say "hello world" --voice geffen_32`, press enter, and the page synthesizes the text and plays it back — printing shell-style output as it goes. The API key stays server-side in a route handler and never reaches the browser.

Pairs with the blog post [Text-to-speech from your terminal: a CLI demo with the Speechify API](https://speechify.ai/blog).

The original idea — reading text aloud straight from the command line — can't be hosted as a shared web page, so this demo is a hostable adaptation: a fake terminal in the browser backed by a real Speechify server route. The genuine CLI ships alongside it in `cli/say.mjs` so you can run the exact same thing in your own shell.

## What you get

- A one-page terminal UI. Supported commands:
  - `speechify say "<text>" [--voice <id>] [--model <id>]` — synthesize and play.
  - `voices` — list the `simba-3.2` voices.
  - `help`, `clear` — the usual.
  - Up/Down arrows walk command history.
- Client-side parsing of the quoted text and `--voice` / `--model` flags, then a `POST` to `app/api/say/route.ts` with `{ text, voiceId, model }` and an `x-turnstile-token` header.
- `app/api/say/route.ts` — a Node runtime route that holds the Speechify key, calls `client.audio.speech`, and returns base64 MP3.
- `cli/say.mjs` — the real, dependency-free CLI (native `fetch` + `node:fs`), for the terminal you actually use.

## Run it yourself

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8769
```

Open `http://localhost:8769`, type `speechify say "hello from my terminal"`, and press enter. Add `--voice harper_32` or `--model simba-english` to change the output.

## Run it as a real CLI

`cli/say.mjs` is a standalone Node script with zero dependencies — no `npm install`, no SDK. It calls the same Speechify speech endpoint the web route uses and writes an MP3.

```bash
export SPEECHIFY_API_KEY=sk_...          # your key
node cli/say.mjs "hello world"           # writes say.mp3
node cli/say.mjs "hello world" --voice harper_32 --model simba-3.2 --out hi.mp3
```

Pipe the audio straight to a player instead of a file with `--out -`:

```bash
node cli/say.mjs "hello world" --out - | ffplay -autoexit -nodisp -   # ffmpeg
node cli/say.mjs "hello world" --out - | mpv -                        # mpv
```

On macOS, `afplay` can't read a pipe — write a file first, then play it:

```bash
node cli/say.mjs "hello world" && afplay say.mp3
```

Flags: `--voice` (default `geffen_32`), `--model` (default `simba-3.2`), `--out` (default `say.mp3`, or `-` for stdout). Run `node cli/say.mjs --help` for the summary.

## How the key stays server-side

The web playground never sees `SPEECHIFY_API_KEY`. The browser parses your command, then POSTs the text to the same-origin `app/api/say` route, which runs only on the server and holds the key. `next.config.ts` marks `@speechify/api` as a server-external package so the SDK is never bundled into client JS. The `cli/say.mjs` script reads the key from your own environment — it runs on your machine, not in a browser.

## Where the code came from

The web route wraps the Speechify TypeScript SDK's `client.audio.speech` call in a Next.js handler. The CLI calls the equivalent REST endpoint (`POST https://api.speechify.ai/v1/audio/speech`) directly with `fetch`, which is all the SDK does under the hood for a one-shot synthesis.

## Prerequisites

- Node 20 or newer
- A `SPEECHIFY_API_KEY` from [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys)
