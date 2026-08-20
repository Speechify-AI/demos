import { NextResponse } from "next/server";
import { verifyTurnstile } from "../../lib/turnstile";

export const runtime = "nodejs";

const BASE = "https://api.speechify.ai";

// Proxies the Voice Agents conversations API so the workspace key never reaches
// the browser. A single id returns that conversation; no id lists recent ones.
export async function POST(req: Request) {
  if (!(await verifyTurnstile(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.SPEECHIFY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "SPEECHIFY_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };

  // conv_ ids only — don't proxy arbitrary paths.
  if (id && !/^conv_[a-z0-9]+$/i.test(id)) {
    return NextResponse.json({ error: "That doesn't look like a conversation id (conv_…)." }, { status: 400 });
  }

  const path = id ? `/v1/agents/conversations/${id}` : `/v1/agents/conversations?limit=20`;

  try {
    const upstream = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON upstream error */
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}`, detail: data ?? text.slice(0, 300) },
        { status: upstream.status },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
