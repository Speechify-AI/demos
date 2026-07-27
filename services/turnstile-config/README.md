# turnstile-config

Shared infra, not a demo. One `GET /api/config` route, mounted at
`/api/turnstile/config` on `demos.speechify.ai` via the root
[`vercel.json`](../../vercel.json) rewrite.

Every hosted demo's frontend calls this through
[`site/public/turnstile.js`](../../site/public/turnstile.js) (`SpeechifyTurnstile.config()`)
before rendering the Cloudflare Turnstile widget, so a fork or local dev
without `TURNSTILE_SECRET_KEY` set skips rendering a widget nothing
server-side will ever check.

This is **not** the security boundary. Each demo's own route handler still
calls Cloudflare's `siteverify` directly with its own
`verifyTurnstile()` (see [`HOSTING.md`](../../HOSTING.md)) before spending a
real API credit. This service only answers "would that check actually run,"
so the client can skip a pointless widget render — losing it fails open to
"render the widget anyway," never to "skip a check that matters."

## Env vars

Read from the shared Vercel project env:

- `TURNSTILE_SECRET_KEY` — the only variable that decides `enabled`. Must
  match the same variable each demo's own `verifyTurnstile()` reads, so this
  endpoint's answer never drifts from what the server actually enforces.
- `TURNSTILE_SITE_KEY` — optional. Lets ops rotate the site key via env
  without redeploying `site/public/turnstile.js`. Omit it and the response
  carries no `siteKey`; the client falls back to the key hardcoded there.

## Local dev

```sh
pnpm --filter turnstile-config dev
curl http://localhost:8767/api/config
```

Without `TURNSTILE_SECRET_KEY` set, returns `{"enabled":false}`.
