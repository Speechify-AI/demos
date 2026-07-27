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

## Adding a shared service

Occasionally something isn't a demo at all — shared infra every demo's
frontend or backend depends on, like `services/turnstile-config`. Same
mechanics as a demo, different folder root, and it must NOT get a `demo.json`
(that's what keeps it out of the landing page and README table):

1. Add `services/<name>` to `pnpm-workspace.yaml`.
2. Add a `services` entry in `vercel.json` with `"root": "services/<name>/"`
   and a `rewrites` rule for whatever public path it should answer on.
3. Give it a real framework (`"framework": "nextjs"` here) — a functions-only
   service with no framework hint silently produces no deploy output on
   Vercel Services. This bit us twice before landing on
   `services/turnstile-config` as a real Next.js app.

## Add Turnstile abuse protection to a hosted demo

Any demo with a browser-facing endpoint that spends real Speechify API credits
should gate those endpoints with [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/).
Without it, anyone can hammer `/api/clone`, `/api/speak`, etc. and drain the
production key that lives in the deployment env.

The shared client helper ships once:

- **[`site/public/turnstile.js`](./site/public/turnstile.js)** — a
  vanilla-JS helper served at `/turnstile.js` on `demos.speechify.ai`. Any
  demo drops in `<script src="/turnstile.js">` and gets widget rendering +
  token retrieval for free. Before rendering, it reconciles against
  **[`services/turnstile-config`](./services/turnstile-config)**
  (`GET /api/turnstile/config`) to check whether the deployment actually has
  `TURNSTILE_SECRET_KEY` set; if not, it skips rendering a widget nothing
  server-side would ever check. That endpoint is a small standalone Next.js
  service (own `vercel.json` entry + `pnpm-workspace.yaml` line) — a
  functions-only service with no framework hint doesn't get built by Vercel
  Services, which is why this exists as a real Next.js app rather than a
  bare `api/*.js` folder.

The server-side verify stays per-demo — each demo's own API route calls
Cloudflare's `siteverify` directly, unrelated to the config endpoint above.
No cross-service Vercel round-trip on the credit-spending path, one
straightforward pattern for every framework. See
[`demos/next-voice-cloning-app/app/lib/turnstile.ts`](./demos/next-voice-cloning-app/app/lib/turnstile.ts)
for the reference implementation — 40 lines, copy verbatim.

### Env vars (set once on the Vercel project)

- `TURNSTILE_SECRET_KEY` — server secret from the Cloudflare Turnstile
  dashboard. Read by each demo's own `verifyTurnstile()` helper (the actual
  gate) and, for presence only, by `services/turnstile-config` (so the
  client-side `enabled` check can never drift from what the server enforces).
  Do not add to any `.env.example`. Do not log. Do not embed in client code.
- `TURNSTILE_SITE_KEY` — optional. Only read by `services/turnstile-config`,
  to let ops rotate the site key via env without redeploying
  `site/public/turnstile.js`. Omit it and the hardcoded key in that file is
  used instead.

Missing `TURNSTILE_SECRET_KEY` → the config endpoint reports `enabled: false`
→ the client skips the widget → the shared verify helper fail-opens anyway →
demos keep working ungated. That's the intended behaviour on forks and local
dev, now consistent between what the client shows and what the server checks.

Turnstile site keys are public in the Cloudflare threat model (they identify
which widget you own, not what someone can do with it), so a widget-domain
allowlist on the Cloudflare dashboard side is what actually gates abuse — not
key secrecy.

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

`reset()` renders with `execution: "execute"` and calls `turnstile.execute()`
itself, both on the first render and again inside `reset()` — it does not
wait on Cloudflare's default post-reset auto-refire. Earlier versions relied
on that implicit behaviour, which meant the *second* action on a page (clone
then speak, generate again) could `getToken()`-timeout to `null`, the server
would see a missing token and 403, and only a full page reload reliably got a
fresh solve. If you copy this pattern into a new demo, keep the explicit
`execute()` calls — don't drop back to relying on automatic re-verification.

When Turnstile is disabled, `getToken()` resolves to `null` and the request
goes through unauthenticated — the server side matches this behaviour, so the
demo works everywhere.

### Server-side integration (in the demo's API route)

Copy [`demos/next-voice-cloning-app/app/lib/turnstile.ts`](./demos/next-voice-cloning-app/app/lib/turnstile.ts)
verbatim (or reimplement the ~15 lines in your framework's server language).
It calls Cloudflare's `siteverify` directly with `TURNSTILE_SECRET_KEY` and
returns a boolean. Use it before doing anything that spends a credit — a
synthesis job, a voice clone, a real API call:

```ts
export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return new Response("Forbidden", { status: 403 });
  }

  // ...proceed with the real work
}
```

When `TURNSTILE_SECRET_KEY` isn't set on the deployment, `verifyTurnstile`
returns `true` — the demo keeps working, just ungated. That's the fail-open
contract that keeps forks and local dev alive without extra config.

### How the fail-open contract keeps forks and local dev working

Server has no `TURNSTILE_SECRET_KEY` → `services/turnstile-config` reports
`enabled: false` → the client skips rendering the widget entirely →
`getToken()` resolves to `null` → the request goes out tokenless →
`verifyTurnstile()` sees no secret configured and short-circuits to `true`
anyway → demo proceeds ungated. Both sides agree, so there's no in-between
state where the widget renders but nothing checks it.

Server has `TURNSTILE_SECRET_KEY` → `enabled: true` → widget renders → user
solves → `verifyTurnstile()` posts to Cloudflare siteverify → gated.

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
