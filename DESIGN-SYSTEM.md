# Design system: alignment & feedback

The demos landing page ([`site/`](./site)) follows the canonical Speechify
design system (`speechify.ai` — the Astro app at `apps/site` in the
`speechify-api` repo).

It started from a **generated design handoff** that used Google-Fonts stand-ins
and its own token set. Bringing it in line with the real system surfaced a
consistent set of places where the *generated* design diverged from the
*canonical* one. Those are captured below as **feedback for the design /
handoff-generation process** — every item is a correction we had to make.

## Where the generated handoff diverged from the design system

Each row: what the handoff specified → what the canonical system actually uses →
what we shipped.

| Element | Handoff (generated) | Canonical (speechify.ai) | Shipped |
| --- | --- | --- | --- |
| **Type system** | 3 fonts: Space Grotesk + IBM Plex Sans + IBM Plex Mono | **1 font: ABCDiatype** for everything | ABCDiatype only |
| **Hero H1 weight** | Space Grotesk **700 (bold)** | ABCDiatype **100 (thin)** | 100 (thin) |
| **H1 letter-spacing** | -0.03em | -0.02em | -0.02em |
| **Ink color** | `#0C0C0C` | `#0A0A0A` | `#0A0A0A` |
| **Secondary text** | `#52525B` | `#525252` | `#525252` |
| **Tertiary/muted text** | `#A1A1A6` | `#666666` | `#666666` |
| **Border** | `#E4E4E6` / `#D1D1D4` | `#E5E5E5` | `#E5E5E5` |
| **Page ground** | `#FCFCFC` | `#FFFFFF` | `#FFFFFF` |
| **Container width** | max-width **1120px** | **max-w-7xl (1280px)** | 1280px |
| **Horizontal gutter** | **28px** | **px-6 (24px)** | 24px |
| **Logo** | "typeset wordmark, no image file exists" | there **is** a logo asset (`speechify-ai-logo.svg`) | real logo |
| **Header eyebrow** | a `DEMOS` mono pill next to the wordmark | no such pill in the system | removed |
| **Hero eyebrow** | `DEMOS.SPEECHIFY.AI` (mono text) | a **breadcrumb** (`Home · Section`, overline token) | breadcrumb `SpeechifyAI · Demos` |
| **Primary CTA label** | "Sign Up Free" | "Get API Key — Free" | "Get API Key — Free" |
| **Primary button** | radius 8px, ~36px, own hover | design-system pill: `rounded-full`, `px-4 py-1.5`, no border | pill, border-equalized |
| **Favicon** | not specified | `favicon.svg` + `apple-touch-icon.png` (brand mark) | added |
| **Analytics** | not included | GTM + PostHog (shared funnel) | ported |
| **Mono usage** | mono for eyebrows/badges/stats/link-lines | system has **no mono** | folded into the single sans |

## Root-cause themes (the actionable feedback)

1. **The generated design invented its own token set instead of the real one.**
   Every color was a near-miss (`#0C0C0C` vs `#0A0A0A`, `#A1A1A6` vs `#666666`,
   `#E4E4E6` vs `#E5E5E5`), the container was narrower (1120 vs 1280) with wider
   gutters (28 vs 24). The generator should consume the **published design
   tokens**, not approximate them. (There is currently no consumable token
   artifact — see #4 — which is likely *why* it approximated.)

2. **The generated design used substitute fonts as if they were the brand
   font — and picked the wrong weight.** The system is one thin font
   (ABCDiatype 100 for display); the handoff shipped three bold Google fonts.
   Substitutes in a handoff must be flagged as non-final AND weight/role-mapped
   to the real type ramp, or they ship looking off-brand.

3. **The generated design asserted things about the brand that are false.** It
   claimed "no logo image file exists" and invented a `DEMOS` pill and a
   `DEMOS.SPEECHIFY.AI` eyebrow. The real system has a logo asset and uses a
   **breadcrumb** as the hero eyebrow. Generation shouldn't fabricate brand
   facts; it should reference the actual component library.

4. **No consumable design-token artifact.** To match the system we hard-copied
   hex values, `@font-face` blocks, container classes, button styles, the
   breadcrumb/overline treatment, and the analytics snippets out of
   `apps/site`. There is no shared token package/CSS to import, so every
   satellite site reimplements and drifts. **Publishing tokens (a CSS file or
   small package) is the single highest-leverage fix** — it would have prevented
   almost every row in the table above.

5. **No portable/licensable font path for public/OSS properties.** ABCDiatype is
   licensed and can't ship in this public MIT repo, so we load it cross-origin
   from `speechify.ai/fonts/` (open CORS). The system needs a sanctioned way to
   use brand type on public properties (licensed CDN, a supported cross-origin
   font contract, or an approved fallback face).

6. **No monospace in the system.** Developer/API-facing surfaces (demos, docs,
   code) want a mono for eyebrows, metrics, code, and URLs — the handoff assumed
   one existed. The system has none; consider adding a sanctioned mono for
   developer surfaces.

7. **Analytics isn't part of the handoff/design baseline.** A brand web surface
   needs the shared GTM + PostHog wiring to fold into the acquisition funnel;
   the generated design omitted it entirely. A "new Speechify web surface"
   checklist should include the analytics stack.

## What we ended up shipping (now matches the system)

- **Font**: ABCDiatype, one family, loaded cross-origin from `speechify.ai`
  (licensed — not committed here).
- **Hero**: thin H1 (weight 100), breadcrumb eyebrow (`SpeechifyAI · Demos`) in
  the overline token (11px / 0.08em / uppercase / medium / `#666666`).
- **Color / layout**: canonical hex tokens, `max-w-7xl` (1280px) + `px-6`
  (24px).
- **Header**: real logo, `Docs` / `GitHub` nav, `Talk to Sales` (outline pill) +
  `Get API Key — Free` (filled pill, equal height), scroll-blur.
- **Favicon**: brand logomark `favicon.svg` + `apple-touch-icon.png`.
- **Analytics**: GTM (`GTM-KG9HDN45`) + PostHog (project `phc_AT7dQ…`, proxy
  `edge.speechify.ai`, `cross_subdomain_cookie`, `person_profiles:
  identified_only`, `capture_pageview` off + manual `$pageview`, dev-gated),
  matching `speechify.ai` so demos folds into the shared funnel. Verified live:
  `edge.speechify.ai/i/v0/e/` returns 200.
- **CTAs**: tagged with `utm_source=demos.speechify.ai` (+ medium/campaign/
  content) so demos-driven signups attribute in the same PostHog funnel.

## Audit against speechify.ai/brand

Checked against the canonical brand page ([speechify.ai/brand](https://speechify.ai/brand),
machine-readable spec at `/brand/llms-full.txt`). Aligned on all the core rules:
monochrome palette (exact hexes), one family (ABC Diatype), thin (100) display,
no weight 600, ink primary button, uppercase wide-tracked eyebrow, sentence-case
numbers-over-adjectives voice.

Corrections the brand page surfaced:

- **Signup attribution is `sfy_*`, not `utm_*`.** The live brand page tags
  signup links `?sfy_source=…&sfy_page=…&sfy_placement=…` (the `apps/site` code
  we first copied still used `utm_*`; the site has since moved on). We switched
  the demos CTAs to `sfy_source=demos.speechify.ai&sfy_page=home&sfy_placement=header-*`.
  Feedback: the attribution convention isn't in the design tokens or the
  `apps/site` snippet we referenced — the `sfy_*` scheme lives only on the live
  site, so a copied surface silently uses the stale `utm_*`. Publish the CTA
  attribution convention alongside the tokens.

- **Two logo assets exist.** The brand page designates
  `/brand/logo/SpeechifyAI-wordmark-black.svg` as the official downloadable
  wordmark, but the site header ships a *different* file at
  `/speechify-ai-logo.svg` (different SVG, same wordmark). We use the header
  version (to match the header we're aligning to). Feedback: the "official" brand
  asset and the shipped header asset diverge — worth reconciling to one file.

## Known remaining coupling / debt

- **Cross-origin font dependency**: the hero relies on `speechify.ai/fonts/*`
  staying at that path with open CORS. If it changes, the type falls back to the
  system sans stack.
- **Analytics is duplicated snippet, not shared**: GTM + PostHog config is
  copied from `apps/site`. If the marketing config changes (key, proxy, flags),
  this copy must be updated by hand. Another argument for a shared package.
