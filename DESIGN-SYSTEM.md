# Design system alignment

The demos landing page ([`site/`](./site)) follows the canonical Speechify
marketing design system (`speechify.ai`, the Astro app at `apps/site` in the
`speechify-api` repo). This file records how they line up and the one deliberate
constraint (the brand font can't ship in this public repo).

## Summary

| Area | Canonical (speechify.ai) | Demos landing (here) | Status |
| --- | --- | --- | --- |
| Font family | **ABCDiatype**, one family for everything | **ABCDiatype**, loaded cross-origin | ✅ aligned |
| Hero H1 weight | 100 (thin) | 100 (thin) | ✅ aligned |
| Color palette | `#0a0a0a` / `#525252` / `#e5e5e5` … | same canonical hex | ✅ aligned |
| Logo | `speechify-ai-logo.svg` | same file (byte-identical) | ✅ aligned |
| Header buttons | ink pill + outline pill | same shape/padding/palette | ✅ aligned |
| Scroll-blur header | yes | ported | ✅ aligned |

## The font: one family, loaded cross-origin

The design system is strict: **ABCDiatype for everything**, weight-mapped
(100/300/400/500/700), never `font-semibold` (600 — no file exists). We match
that: one `--font-sans`, with `--font-display` and `--font-mono` aliased to it.

**ABCDiatype is a licensed commercial font (ABC Dinamo) and must NOT be
redistributed in this public, MIT-licensed repo.** So we do not commit the
`.woff2` files here. Instead the landing page's `@font-face` rules load them
cross-origin from the marketing origin, which already hosts them and serves
`/fonts/*.woff2` with `Access-Control-Allow-Origin: *`:

```
https://speechify.ai/fonts/ABCDiatype-{Thin,Light,Regular,Medium,Bold}.woff2
```

Tradeoff: the landing page depends on `speechify.ai` serving those font files
with open CORS. If that origin changes the path, removes the files, or tightens
CORS, the demos hero silently falls back to the system sans stack. Acceptable
for a demos index; revisit if it needs to be fully self-contained (which would
require a licensed, committable font or a licensed CDN).

## Type roles

- **Hero H1** — `font-weight: 100` (thin), `clamp(36px,5.5vw,60px)`,
  line-height 1.02, letter-spacing -0.02em. Matches the canonical `text-display`
  thin treatment.
- **Card titles** — `font-weight: 400` (normal), matching the canonical
  `text-title` weight.
- **Eyebrow / labels / stats / link-lines** — ABCDiatype at 400/500. (Design
  note below: the handoff wanted a monospaced treatment here, which the
  single-font system has no glyph set for.)

## Color tokens

Aligned to the canonical hex: `--foreground #0a0a0a`, `--foreground-secondary
#525252`, `--muted #f5f5f5`, `--muted-foreground #666666`, `--border #e5e5e5`,
`--primary-foreground #fafafa`, `--background #ffffff`. The landing page's local
aliases (`--text-primary`, `--surface-*`, etc.) now map onto these exact values
rather than the near-miss set the handoff shipped with.

## Feedback for the design system

Captured while aligning this page — gaps the demos surface exposed:

1. **No portable / licensable font path for satellite sites.** The brand font is
   self-hosted in the private-ish marketing repo, but a public OSS repo (demos)
   can't legally ship it. Today the only options are cross-origin loading from
   `speechify.ai` (fragile coupling) or a substitute font (off-brand). The design
   system should define a sanctioned way to use the brand type on public/OSS
   properties — e.g. a licensed webfont CDN, a documented cross-origin font
   endpoint that's a supported contract (stable path + CORS), or an approved
   fallback face.

2. **No monospace in the system.** The demos design (and API/code-oriented
   surfaces generally) wants a mono treatment for eyebrows, metrics, code, and
   URL/link labels. ABCDiatype has no mono; the system currently has no answer,
   so this page falls back to the single sans. Consider adding a sanctioned mono
   (or an approved pairing) for developer-facing properties.

3. **Design tokens aren't published as a consumable artifact.** To match the
   system, this repo had to hard-copy hex values and `@font-face` blocks out of
   `apps/site/src/styles/global.css`. There's no shared token package/CSS these
   values can be imported from, so every satellite reimplements and drifts.
   Publishing the tokens (a CSS file or small package) would let other Speechify
   web surfaces consume them instead of copying.

4. **Handoff substitutes leaked toward "real".** The demos handoff specified
   Google-Fonts substitutes (Space Grotesk / IBM Plex) as stand-ins, but without
   a clear "swap to brand before ship" step they nearly became the shipped
   design. Handoffs should flag substitute assets explicitly as non-final.
