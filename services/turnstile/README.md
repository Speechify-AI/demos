# Turnstile service

Internal Vercel service. Two Edge endpoints that any hosted demo can use to
gate its server routes with [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/):

- `GET /api/turnstile/config` — returns `{ enabled, siteKey? }`. Client helper
  reads this on load to decide whether to render the widget at all.
- `POST /api/turnstile/verify` — takes `{ token }`, calls Cloudflare siteverify
  with the secret, returns `{ verified }`.

Both endpoints fail-open when `TURNSTILE_SECRET_KEY` (verify) or
`TURNSTILE_SITE_KEY` (config) is missing. This is the point: local dev and fork
deploys work with zero setup.

Runtime is Edge — verify sits on the hot path of every gated API call, and
~1ms cold starts keep the added latency invisible.

Not a public demo. Not listed in the demos table. Reached only via the
`/api/turnstile/:path*` rewrite in [`/vercel.json`](../../vercel.json), and by
the client helper at [`/site/public/turnstile.js`](../../site/public/turnstile.js).

See [HOSTING.md](../../HOSTING.md#add-turnstile-abuse-protection-to-a-hosted-demo)
for the integration guide.
