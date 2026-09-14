// Minimal in-memory per-IP rate limit. Good enough for a reference demo on a
// single Vercel function instance; resets on redeploy/cold start. This is not
// meant to replace Turnstile - Turnstile proves a human solved a challenge
// once, this bounds how many paid requests that same caller can send after.
const hits = new Map<string, number[]>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export function rateLimit(req: Request, opts: RateLimitOptions): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter(
    (t) => now - t < opts.windowMs,
  );

  if (timestamps.length >= opts.max) {
    hits.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  hits.set(ip, timestamps);
  return true;
}
