// Public config for the Turnstile widget. Returns the site key when both keys
// are configured; returns { enabled: false } otherwise so demos can silently
// skip widget rendering in local dev or on forks where the operator has not
// set up Turnstile.
//
// Cached at the edge for 60s — flipping the env var doesn't need to be
// real-time and this endpoint gets hit by every gated demo page load.
export const config = { runtime: "edge" };

export default function handler() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);
  // "Enabled" iff BOTH keys are set. Site key alone can't verify anything;
  // secret alone can't render a widget. The client checks .enabled and
  // silently no-ops when false, so partial config never breaks a demo.
  const enabled = Boolean(siteKey) && secretConfigured;
  const body = enabled ? { enabled: true, siteKey } : { enabled: false };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
