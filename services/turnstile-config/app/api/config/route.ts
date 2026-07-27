import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Public config every hosted demo's frontend reconciles against before
// rendering the Turnstile widget. "Enabled" tracks TURNSTILE_SECRET_KEY
// alone - that's the only variable each demo's own server-side
// verifyTurnstile() actually checks, so this must match it exactly. Gating
// "enabled" on the site key too would let the two go out of sync: secret set
// but site key env var not set would report disabled, the client would skip
// rendering entirely, every gated request would arrive tokenless, and the
// server (which only cares about the secret) would 403 all of them.
//
// TURNSTILE_SITE_KEY is optional here: it lets ops rotate the key via env
// without redeploying the client script. Omit it and the client falls back
// to the public key already hardcoded in site/public/turnstile.js.
//
// This is never the security boundary itself - losing this endpoint fails
// open to "render the widget anyway" in the client, never to "skip a check
// that matters."
export async function GET() {
  const enabled = Boolean(process.env.TURNSTILE_SECRET_KEY);
  const siteKey = process.env.TURNSTILE_SITE_KEY;

  return NextResponse.json(
    enabled ? { enabled: true, ...(siteKey ? { siteKey } : {}) } : { enabled: false },
    {
      headers: {
        // Flipping the env var doesn't need to be real-time; every gated
        // demo page load hits this.
        "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
