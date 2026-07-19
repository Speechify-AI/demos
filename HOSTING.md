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

[`demos.json`](./demos.json) is the single source of truth for the demo list.
`pnpm generate` (also run as part of the build) reads it and writes:

- the demos table in [`README.md`](./README.md), between the `DEMOS:START` /
  `DEMOS:END` markers, and
- the manifest the landing page renders from.

Edit `demos.json`, not the generated table.

A demo's `hosted: true` flag is what gives it a live link in the README table and
on the landing page. Keep it in sync with whether the demo is actually registered
as a service below.

## Adding a hostable demo

Demos live under `demos/<slug>/`, but are served at `/<slug>` (not
`/demos/<slug>`) — the folder path and the public URL are deliberately separate.

1. Add `demos/<slug>` to [`pnpm-workspace.yaml`](./pnpm-workspace.yaml).
2. In [`vercel.json`](./vercel.json), add a `services` entry with
   `"root": "demos/<slug>/"` and a `rewrites` rule whose `source` is `/<slug>/:path*`.
3. Mount the app under its `/<slug>` prefix (e.g. Next.js `basePath`).
4. Set `hosted: true` for the demo in [`demos.json`](./demos.json) and run
   `pnpm generate`.
