# Discord bot that speaks

A Discord slash-command bot that speaks with the Speechify API. Pairs with the
speechify.ai post *"Build a Discord bot that speaks with the Speechify API"*.

## What you get

A single-file Node bot with one command:

- **`/speak <text>`** — synthesizes the text with `client.audio.speech()`
  (Speechify) and posts the MP3 into the channel.
- The `/speak` command registers itself automatically on first run.

## Run it yourself

First, create the Discord application:

1. https://discord.com/developers/applications → **New Application**.
2. **Bot** → copy the token, and (if not a server you own) enable
   *Server Members Intent* isn't needed here — just add the bot to a server via
   the **OAuth2 → URL Generator** (scope `applications.commands` + `bot`).
3. Copy your **Application ID** (Client ID) from the General Information tab.

Then run it:

```bash
cp .env.example .env      # paste SPEECHIFY_API_KEY, DISCORD_TOKEN, DISCORD_CLIENT_ID
npm install
npm start
```

In any server the app is invited to, type `/speak Hello from my Discord bot`.
The bot replies with an MP3 of the text spoken by the configured voice.

Prerequisites: Node 20+, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Where the code came from

Uses `discord.js` v14 for the client and command registration, and the
Speechify `@speechify/api` client — the same `client.audio.speech()` call used
across the [demos repo](../). The bot reads the configured `voice_id` (default
`geffen_32`) and `model` (default `simba-3.2`) from `.env` if you want a
different voice — the defaults are the docs' canonical English pairing; the
retired `simba-english` / `simba-multilingual` models are not supported.