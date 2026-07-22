# Hosting

This repo is a set of standalone, clone-and-run demos. The web-hostable ones are
*also* deployed together as a single site at
[demos.speechify.ai](https://demos.speechify.ai)/`<demo-name>`. This file covers
that deployment; it is internal plumbing and not needed to run any demo locally.

## One Vercel project, many demos

The whole repo deploys as **one** Vercel project using
[Vercel Services](https://vercel.com/docs/services). Each hostable demo is a
service in [`vercel.json`](./vercel.json): built independently, keeping its own
serverless endpoints, and routed under its own path prefix. Using one project
(rather than one project per demo) avoids the per-project microfrontends fee.

Only web demos are registered as services. Terminal scripts, Python pipelines,
and long-running agent workers are not deployable to Vercel and are simply left
out of `vercel.json` — they stay clone-and-run.

## Landing page and the demos manifest

The demo list is assembled from two sources, each authoritative for what it owns:

- **`demos/<slug>/demo.json`** (one per demo folder) — the demo's card metadata:
  `order` (display order; tiebroken alphabetically by slug), `title`, `stack`,
  `blurb`. The folder name is the slug.
- **[`vercel.json`](./vercel.json)** — which demos are *hosted*. A demo is hosted
  iff a rewrite routes `/<slug>` to its service. There is no `hosted` flag to keep
  in sync — the routing config *is* the truth.

`pnpm generate` (also run as part of the build) globs every `demos/*/demo.json`,
cross-references `vercel.json` for hosted status, and writes:

- the demos table in [`README.md`](./README.md), between the `DEMOS:START` /
  `DEMOS:END` markers,
- the manifest inlined into the landing page,
- the JSON-LD, `sitemap.xml`, and `llms.txt` / `llms-full.txt`.

Edit the per-folder `demo.json`, not the generated outputs. The generator can't
*write* `vercel.json` (Vercel reads it before the build runs), so hosting is
configured directly in `vercel.json`.

## Design system

The landing page follows the canonical Speechify brand and design system:
**[speechify.ai/brand](https://speechify.ai/brand)** (machine-readable spec:
[`/brand/llms-full.txt`](https://speechify.ai/brand/llms-full.txt)). Match it for
any change to type, color, logo, buttons, or copy — one font (ABC Diatype),
monochrome palette, thin display type, ink primary buttons, sentence-case voice.

ABC Diatype is licensed and is **not** committed to this public repo; it is
loaded cross-origin from `speechify.ai/fonts/`. Signup CTAs carry
`sfy_source=demos.speechify.ai` for attribution.

## Adding a hostable demo

Demos live under `demos/<slug>/`, but are served at `/<slug>` (not
`/demos/<slug>`) — the folder path and the public URL are deliberately separate.

1. Add `demos/<slug>` to [`pnpm-workspace.yaml`](./pnpm-workspace.yaml).
2. In [`vercel.json`](./vercel.json), add a `services` entry with
   `"root": "demos/<slug>/"` and a `rewrites` rule whose `source` is `/<slug>/:path*`.
3. Mount the app under its `/<slug>` prefix (e.g. Next.js `basePath`).
4. Run `pnpm generate`. The demo is now hosted (its `vercel.json` rewrite is the
   hosted signal) and its card gets a live link automatically — no flag to set.

## Add Turnstile abuse protection to a hosted demo

Any demo with a browser-facing endpoint that spends real Speechify API credits
should gate those endpoints with [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/).
Without it, anyone can hammer `/api/clone`, `/api/speak`, etc. and drain the
production key that lives in the deployment env.

The infrastructure ships once in this repo:

- **[`site/api/turnstile/`](./site/api/turnstile)** — two Edge functions
  (`GET /api/turnstile/config`, `POST /api/turnstile/verify`) that live in
  the `site` service and are served from the root of `demos.speechify.ai`.
  Every demo can call them — no per-demo wiring, no code duplication.
- **[`site/public/turnstile.js`](./site/public/turnstile.js)** — a
  ~100-line vanilla-JS client helper, served at `/turnstile.js` on
  `demos.speechify.ai`. Any demo can drop in a `<script src="/turnstile.js">`
  and get widget rendering + token retrieval for free.

### Env vars (set once on the Vercel project)

Both must be set for Turnstile to actually gate anything. Missing either one
disables the whole system — locally, on forks, and on any environment where
the operator hasn't set them. Demos keep working, they just aren't gated.

- `TURNSTILE_SITE_KEY` — public site key from the Cloudflare Turnstile
  dashboard. Safe to expose to the browser; the config endpoint hands it out
  when both keys are set. Never commit it — the missing-var behaviour is what
  keeps fork deploys and local dev working.
- `TURNSTILE_SECRET_KEY` — server secret from the same dashboard. Only ever
  touched by `services/turnstile/api/verify.js`. Do not add to any
  `.env.example`. Do not log. Do not embed in client code.

### Client-side integration (in the demo's browser page)

Drop the widget container, load the helper, render on `DOMContentLoaded`:

```html
<div id="turnstile-container"></div>

<script src="/turnstile.js"></script>
<script>
  window.addEventListener("DOMContentLoaded", async () => {
    window.__turnstile = await SpeechifyTurnstile.render("#turnstile-container");
  });
</script>
```

Attach the token to any request that hits a gated server route, and reset the
widget after use (Turnstile tokens are single-use):

```js
async function submit(payload) {
  const token = await window.__turnstile.getToken();
  const headers = { "content-type": "application/json" };
  if (token) headers["x-turnstile-token"] = token;

  const r = await fetch("/my-demo/api/whatever", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  window.__turnstile.reset();
  return r.json();
}
```

When Turnstile is disabled, `getToken()` resolves to `null` and the request
goes through unauthenticated — the server side matches this behaviour, so the
demo works everywhere.

### Server-side integration (in the demo's API route)

Verify the token BEFORE doing anything that spends a credit — a network call,
a synthesis job, a voice clone. One extra fetch to the local verify endpoint,
Edge-runtime fast:

```ts
export async function POST(req: Request) {
  const token = req.headers.get("x-turnstile-token");
  const verifyRes = await fetch(new URL("/api/turnstile/verify", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const { verified } = await verifyRes.json();
  if (!verified) {
    return new Response("Forbidden", { status: 403 });
  }

  // ...proceed with the real work
}
```

`new URL('/api/turnstile/verify', req.url)` builds an absolute URL from the
incoming request's origin, so this works in prod (`demos.speechify.ai`),
preview URLs, and local `vercel dev` without any env-var wrangling.

When Turnstile isn't configured, the verify endpoint responds
`{ verified: true, disabled: true }` — the demo keeps working. If you want to
telemetry the disabled state (e.g. warn in logs on a real prod deploy), read
the `disabled` field.

### How the fail-open contract keeps forks and local dev working

Neither key set → `/api/turnstile/config` returns `{ enabled: false }` → the
client helper skips widget rendering → `getToken()` returns `null` → the demo
sends its request without a token → the server calls `/api/turnstile/verify`,
which sees no `TURNSTILE_SECRET_KEY` and responds `verified: true` → the demo
proceeds.

Both keys set → widget renders → user solves the challenge → token attached to
the fetch → server verifies against Cloudflare siteverify → gated.

There is no intermediate state where a demo half-works. Set both keys or none.

### Reference integration

[`demos/next-voice-cloning-app`](./demos/next-voice-cloning-app) is the
canonical example. It gates all three of its API routes (`clone`, `speak`,
`voice`) and shows the Next.js-idiomatic client integration:

- Client: [`app/layout.tsx`](./demos/next-voice-cloning-app/app/layout.tsx)
  loads `/turnstile.js` via `next/script` with `strategy="beforeInteractive"`;
  [`app/page.tsx`](./demos/next-voice-cloning-app/app/page.tsx) renders the
  widget in the form and attaches the token to every gated `fetch`.
- Server: a shared
  [`app/lib/turnstile.ts`](./demos/next-voice-cloning-app/app/lib/turnstile.ts)
  helper does the verify call and is imported by each route. Copy the file
  into a new demo verbatim — the fail-open contract makes it portable.
