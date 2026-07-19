# Contributing

Thanks for adding a demo. This repo is a collection of small, self-contained
examples for the Speechify API. Each demo lives in its own folder under
[`demos/`](./demos) and must run on its own — someone can copy that one folder,
follow its README, and run it without the rest of the repo.

A subset of demos (the web ones) are also deployed together at
[demos.speechify.ai](https://demos.speechify.ai). Getting a demo hosted is
optional and covered in [Hosting a demo](#hosting-a-demo) below.

## Make a demo

1. Create a folder under `demos/` named after your demo, in `kebab-case`. The
   folder name is the demo's `slug` everywhere else (manifest, and its hosted
   path if hosted — served at `/<slug>`, not `/demos/<slug>`).
2. Make it self-contained. Everything the demo needs lives in its folder.
3. Include an `.env.example`. Every demo needs `SPEECHIFY_API_KEY`; contributors
   copy `.env.example` to `.env`. Never commit a real `.env` — the root
   `.gitignore` ignores `.env` and `.env.*` (except `.env.example`).
4. Write the demo's own `README.md`. There is no strict template, but match the
   existing demos so the set reads consistently. Most have:
   - a one-line intro and a link to the blog post it pairs with (if any),
   - **What you get** — what the demo does,
   - **Run it yourself** — exact copy/paste steps (`cp .env.example .env`, install, run),
   - **Where the code came from** — link the SDK recipe / source it's based on,
   - **Prerequisites** — runtime versions, plan requirements (e.g. voice cloning).
5. Keep secrets server-side. If the demo has any browser/frontend surface, the
   `SPEECHIFY_API_KEY` must never reach the client — proxy calls through a
   server route or a tiny local server, like the existing hosted demo does.

### Per-language notes

- **Python** (e.g. `audiobook-pipeline`): include a `requirements.txt`. No
  `package.json`. The root `.gitignore` already covers `__pycache__/`, `.venv/`,
  etc.
- **TypeScript / Node** (e.g. `ssml-emotion-tts`, `captions-speech-marks`):
  include `package.json` and `tsconfig.json`. Do not commit a lockfile for a
  standalone (non-hosted) demo — the root `.gitignore` ignores `package-lock.json`
  and `yarn.lock`.
- **Committed output**: some demos commit a small `output/` sample so the README
  can show a result. Keep such samples tiny.

## Get it listed in the demos table

The root README's demos table is **generated** — do not edit it by hand. It comes
from [`demos.json`](./demos.json), the single source of truth. Add an entry:

```json
{
  "slug": "your-demo-folder",
  "title": "Human-readable name",
  "stack": "Python (SDK)",
  "hosted": false,
  "blurb": "One sentence describing what it does."
}
```

Then run:

```bash
pnpm generate
```

That rewrites the demos table in the README (between the `DEMOS:START` /
`DEMOS:END` markers) and the landing-page manifest. Commit the regenerated
README. Leave `hosted: false` unless you're also doing the hosting steps below.

## Hosting a demo

Hosting is optional. Only web demos can be hosted — terminal scripts, Python
pipelines, and long-running agent workers stay clone-and-run and keep
`hosted: false`.

If your demo is a web app (or has a browser surface backed by serverless
endpoints) and you want it live at `demos.speechify.ai/<slug>`, follow the steps
in [HOSTING.md](./HOSTING.md). In short: add the folder to
[`pnpm-workspace.yaml`](./pnpm-workspace.yaml) (as `demos/<slug>`), register it
as a service (root `demos/<slug>/`) with a rewrite in
[`vercel.json`](./vercel.json), mount it under its `/<slug>` prefix
(e.g. Next.js `basePath`), set `hosted: true` in `demos.json`, and run
`pnpm generate`.

Setting `hosted: true` and re-running `pnpm generate` is what adds the **Live**
link to the README table and the landing page — so the demo goes live on the site
and gets its link in the same change.

Verify it builds before opening the PR:

```bash
pnpm install
pnpm build
```

## Pull requests

- **External contributors:** open a pull request against `main`. The branch is
  protected — a PR needs **one approving review**, and **all commits must be
  signed** (`git commit -S`; see
  [GitHub's commit-signing guide](https://docs.github.com/authentication/managing-commit-signature-verification)).
- **Maintainers** with bypass access may commit directly to `main` for small or
  time-sensitive changes; use a PR when you want review.
- Use [Conventional Commits](https://www.conventionalcommits.org/): e.g.
  `feat: add drive-thru voice agent demo`, `fix(captions): handle empty speech marks`,
  `docs: clarify prerequisites`.
- Keep a PR to one demo (or one focused change) where possible.
- If your change touches `demos.json` or hosting config, include the regenerated
  README in the same PR so the table stays in sync.

## Get an API key

Every demo needs `SPEECHIFY_API_KEY`. Grab one at
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).
