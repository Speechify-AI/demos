// Verifies a Turnstile token by calling the shared /api/turnstile/verify
// endpoint. Returns true iff the caller is allowed to proceed.
//
// Fail-open contract: when the verify endpoint isn't reachable (local dev
// without `vercel dev`, or an unlikely outage) OR when the shared endpoint
// itself reports `disabled: true` (env vars not configured on this
// deployment), returns true. The alternative is breaking the demo whenever
// Turnstile isn't configured or isn't working — a worse experience than
// leaving the abuse gate briefly open. Real prod hardening would flip this
// to fail-closed; this is a reference demo.
export async function verifyTurnstile(req: Request): Promise<boolean> {
  const token = req.headers.get("x-turnstile-token");
  try {
    const verifyRes = await fetch(new URL("/api/turnstile/verify", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!verifyRes.ok) return true;
    const data = (await verifyRes.json()) as { verified?: boolean };
    return Boolean(data.verified);
  } catch {
    return true;
  }
}
