# webpage-audiobook

Turn any webpage into a narrated audiobook with the Speechify TTS API. Paste a URL; the server fetches the article, extracts the readable text, chunks it, and synthesizes each part.

Pairs with the speechify.ai post **"Turn any webpage into an audiobook with the Speechify API."**

## What it does

- `POST /api/audiobook` (Node runtime) takes `{ url }`, fetches the page, extracts text, chunks it on sentence boundaries into ~500-800 character segments, and synthesizes each with `POST /v1/audio/speech` (`model: "simba-3.2"`, MP3). Returns `{ title, truncated, chunks: [{ audio, text }] }`.
- The page plays the chunks back to back, so a long article reads through as one audiobook.
- Long articles are capped at the first 6 chunks to keep the demo cheap; `truncated` flags when that happens.

## Honest limitations

- **Extraction is naive and dependency-free** (strip scripts/styles, pull `<p>`/`<h*>`/`<li>` text). A production build should use a real readability extractor.
- **Server-side URL fetch has a minimal SSRF guard** (http/https only, private hosts rejected). Production needs DNS resolution checks and stricter allowlisting.
- The Speechify API key stays server-side; the browser only calls this app's `/api/audiobook`.

## Run it

```bash
cp .env.example .env   # add your SPEECHIFY_API_KEY
pnpm install
pnpm dev               # http://localhost:8782/webpage-audiobook
pnpm e2e               # end-to-end against the live API (needs SPEECHIFY_API_KEY)
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPEECHIFY_API_KEY` | yes | Server-side Speechify API key |
| `TURNSTILE_SECRET_KEY` | no | Enables the Turnstile abuse gate; fails open when unset |
