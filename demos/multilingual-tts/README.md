# multilingual-tts

Read text in any of 30+ languages with the Speechify TTS API, one native voice per language. Pick a language, hear it spoken by a voice native to that locale.

Pairs with the speechify.ai post **"Text-to-speech in 30+ languages with the Speechify API."**

## What it does

- A one-page Next.js playground with a language picker and a text box. Choose a language, press **Speak**, and the text is synthesized in a voice native to that locale.
- `POST /api/speak` (Node runtime) calls Speechify's `POST /v1/audio/speech` with `model: "simba-3.0"`, `audio_format: "mp3"`, and the `language` parameter, then returns the audio as base64.
- The whole feature is that one `language` field. `simba-3.0` is the multilingual, streaming-native model.

## The six wired-up languages

Each uses a voice native to the locale (from the public catalogue). `simba-3.0` officially supports these; the catalogue carries 30+ more locales.

| Language | Locale | Voice |
| --- | --- | --- |
| English | `en-US` | `alfonso` |
| German | `de-DE` | `amalia` |
| Spanish | `es-MX` | `aitana` |
| French | `fr-FR` | `adeline` |
| Italian | `it-IT` | `alessia` |
| Portuguese (Brazil) | `pt-BR` | `adriana` |

To add a language: pick a voice for the locale at [platform.speechify.ai](https://platform.speechify.ai), then add a row to `LANGUAGES` in `app/page.tsx` and to `ALLOWED_LANGUAGES` in `app/api/speak/route.ts`.

## Notes

- `simba-3.2` and `simba-english` are English-only. Non-English synthesis uses `simba-3.0` (or `simba-multilingual` on an API version pinned before `2026-09-21`, which sunsets `2026-11-21`).
- The Speechify API key stays server-side. The browser only ever calls this app's own `/api/speak` route.
- Abuse protection is Cloudflare Turnstile, which fails open when `TURNSTILE_SECRET_KEY` is unset (local dev).

## Run it

```bash
cp .env.example .env   # add your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8781/multilingual-tts
```

End-to-end test against the live API (needs `SPEECHIFY_API_KEY`):

```bash
pnpm e2e
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPEECHIFY_API_KEY` | yes | Server-side Speechify API key |
| `TURNSTILE_SECRET_KEY` | no | Enables the Turnstile abuse gate; fails open when unset |
