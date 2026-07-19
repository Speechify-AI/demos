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
