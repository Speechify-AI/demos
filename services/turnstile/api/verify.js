// Central Turnstile verification. Each hosted demo's server-side route posts
// { token } here BEFORE doing anything that spends real Speechify API credits.
//
// Fail-open when TURNSTILE_SECRET_KEY is missing — that's how local dev and
// fork deploys keep working without asking every contributor to sign up for
// Turnstile. Callers get { verified: true, disabled: true } and can log the
// disabled state if they want.
export const config = { runtime: "edge" };

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Turnstile not configured — no gating anywhere in the deployment. Return
    // a positive verdict so demos don't need conditional code, but flag it as
    // disabled so callers can telemetry the state if they care.
    return json({ verified: true, disabled: true });
  }

  let token;
  try {
    const body = await request.json();
    token = typeof body?.token === "string" ? body.token : null;
  } catch {
    return json({ verified: false, error: "invalid-json" }, 400);
  }
  if (!token) {
    return json({ verified: false, error: "missing-token" }, 400);
  }

  // Cloudflare siteverify takes form-encoded, not JSON.
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  const remoteip = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (remoteip) form.set("remoteip", remoteip);

  let cf;
  try {
    cf = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
  } catch (err) {
    // Never leak the outbound error to the client — but flag it so callers can
    // decide whether to hard-fail or degrade gracefully.
    return json({ verified: false, error: "siteverify-unreachable" }, 502);
  }
  if (!cf.ok) {
    return json({ verified: false, error: "siteverify-status" }, 502);
  }
  const result = await cf.json().catch(() => ({}));
  return json({ verified: Boolean(result?.success) });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Every Turnstile token is single-use — never cache verification results.
      "cache-control": "no-store",
    },
  });
}
