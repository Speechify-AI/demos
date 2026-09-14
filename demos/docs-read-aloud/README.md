# Read-aloud for a docs site

A documentation-style page with a **Listen** button that reads the article aloud
via the Speechify API. Pairs with the speechify.ai post *"Add read-aloud to a
documentation site with the Speechify API"*.

## What you get

A small, framework-agnostic web demo:

- a docs-style HTML page (`public/index.html`) with a Listen button,
- a zero-dependency Node server (`src/index.ts`) that serves the page and a
  `POST /api/speak` route,
- the button posts the article text to `/api/speak`, which synthesizes it with
  `client.audio.speech()` (Speechify) and returns the MP3 for the browser to
  play.

The Speechify key stays **server-side** — it never reaches the browser.

## Run it yourself

```bash
cp .env.example .env      # paste your key into .env
npm install
npm start                 # serves http://localhost:8787
```

Open http://localhost:8787 and click **Read this page aloud**. To point the page
at a real docs article, replace the sample `<article>` content or swap the
innerText extraction in `public/index.html`.

Prerequisites: Node 20+, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Where the code came from

Uses the Speechify `@speechify/api` client — the same `client.audio.speech()`
call used across the [demos repo](../). The pattern (button → server route →
audio back) is the one to copy into any docs framework: the button only needs a
request to a server endpoint that holds the key. Voice and model are
configurable via `.env`.

## Notes

- This clone-and-run demo isn't deployed to `demos.speechify.ai`. If you host
  the endpoint where it spends real credits, gate it with Turnstile like the
  hosted demos do (see `HOSTING.md`).