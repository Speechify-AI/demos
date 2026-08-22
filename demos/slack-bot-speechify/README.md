# Slack bot that reads aloud

A Slack bot that reads every new message in a channel aloud. On each message it
synthesizes the text with the Speechify API and posts the MP3 back into the
channel as a file. Pairs with the speechify.ai post *"Build a Slack bot that
reads messages aloud with the Speechify API"*.

## What you get

A single-file Node bot that uses Slack Socket Mode (no public URL, no tunnel):

1. joins a channel and listens for new messages,
2. skips its own posts and bot traffic,
3. synthesizes the message text with `client.audio.speech()` (Speechify),
4. posts the resulting MP3 back into the channel as a file.

## Run it yourself

First, create a Slack app:

1. https://api.slack.com/apps → **Create New App** → *From scratch*.
2. **Socket Mode**: enable it and create an **App-Level Token** (`xapp-...`) with
   the `connections:write` scope.
3. **Event Subscriptions**: enable, subscribe to `message.channels`.
4. **OAuth & Permissions**: add bot scopes `files:write` and `chat:write`,
   install the app to your workspace, and copy the **Bot User OAuth Token**
   (`xoxb-...`).
5. Invite the bot to a channel (`/invite @<bot-name>`).

Then run it:

```bash
cp .env.example .env      # paste SPEECHIFY_API_KEY, SLACK_APP_TOKEN, SLACK_BOT_TOKEN
npm install
npm start
```

Say anything in the channel the bot is in — it reads the message aloud and posts
the audio back. Stop it with `Ctrl-C`.

Prerequisites: Node 20+, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Where the code came from

Uses the official `@slack/socket-mode` + `@slack/web-api` clients and the
speechify `@speechify/api` client — the same `client.audio.speech()` call used
across the [demos repo](../). The bot reads the configured `voice_id` (default
`george`) and `model` (default `simba-english`) from `.env` if you want a
different voice.