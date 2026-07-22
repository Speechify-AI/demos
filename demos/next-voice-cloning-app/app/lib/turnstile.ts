// Verifies a Turnstile token against Cloudflare siteverify. Returns true iff
// the caller is allowed to proceed.
//
// Fail-open contract: when TURNSTILE_SECRET_KEY isn't set (local dev, fork
// deploys, anywhere the operator hasn't configured Turnstile) OR when the
// siteverify request itself errors, returns true. The alternative is
// breaking the demo whenever Turnstile isn't configured — a worse experience
// than leaving the abuse gate briefly open. Real prod hardening would flip
// this to fail-closed; this is a reference demo.
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(req: Request): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const token = req.headers.get("x-turnstile-token");
  if (!token) return false;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  const remoteip = req.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (remoteip) form.set("remoteip", remoteip);

  try {
    const cf = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    if (!cf.ok) return true;
    const result = (await cf.json()) as { success?: boolean };
    return Boolean(result?.success);
  } catch {
    return true;
  }
}
