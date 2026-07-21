// simba-showcase worker
//
// Serves the static showcase page (ASSETS) and a small same-origin API that
// keeps the workspace key server-side:
//
//   POST /api/outbound-call   {phone}            -> starts the demo call
//   GET  /api/call-status?id=conv_...            -> status for the countdown UI
//   POST /api/end-call        {conversation_id}  -> ends the call now
//
// The 5-minute cap has three layers:
//   1. the page counts down and calls /api/end-call at 5:00
//   2. the cron sweeper (every minute) force-ends anything older than 5:00
//   3. the agent's flow wraps up on its own around the 4-minute mark

const RATE = {
  perIP: { max: 4, windowMs: 60 * 60 * 1000 },
  perPhone: { max: 2, windowMs: 15 * 60 * 1000 },
};
const MAX_CONCURRENT_DEMO_CALLS = 2;

// Best-effort, per-isolate memory (resets on isolate recycle — fine for a demo).
const hits = new Map();

function rateLimited(key, rule) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < rule.windowMs);
  if (list.length >= rule.max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sva(env, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${env.API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.SPEECHIFY_API_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  return { ok: res.ok, status: res.status, data, text };
}

// Demo calls are restricted to US numbers: +1 followed by a 10-digit
// national number (area code and exchange can't start with 0 or 1).
function normalizePhone(raw) {
  const cleaned = String(raw || "").replace(/[\s().-]/g, "");
  return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(cleaned) ? cleaned : null;
}

async function listDemoCalls(env, status) {
  const q = `agent_id=${env.OUTBOUND_AGENT_ID}&status=${status}&limit=20`;
  const res = await sva(env, "GET", `/v1/agents/conversations?${q}`);
  return res.ok ? res.data?.conversations || [] : [];
}

async function endConversation(env, id) {
  return sva(env, "POST", `/v1/agents/conversations/${id}/end`);
}

// Only ever expose/act on conversations that belong to the showcase
// outbound agent — the workspace key can see every conversation.
async function getDemoConversation(env, id) {
  if (!/^conv_[a-z0-9]+$/i.test(id)) return null;
  const res = await sva(env, "GET", `/v1/agents/conversations/${id}`);
  const conv = res.ok ? res.data?.conversation || res.data : null;
  if (!conv || conv.agent_id !== env.OUTBOUND_AGENT_ID) return null;
  return conv;
}

async function handleOutboundCall(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const phone = normalizePhone(body.phone);
  if (!phone) {
    return json({ error: "Only US numbers can receive demo calls — enter it like +1 415 555 0123." }, 400);
  }
  if (!env.SPEECHIFY_API_KEY) {
    return json({ error: "Outbound demo isn't wired up yet (missing API key on the worker)." }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(`ip:${ip}`, RATE.perIP) || rateLimited(`ph:${phone}`, RATE.perPhone)) {
    return json({ error: "Demo call limit reached — try again a little later." }, 429);
  }

  const [active, pending] = await Promise.all([
    listDemoCalls(env, "active"),
    listDemoCalls(env, "pending"),
  ]);
  if (active.length + pending.length >= MAX_CONCURRENT_DEMO_CALLS) {
    return json({ error: "The demo line is busy right now — try again in a few minutes." }, 429);
  }

  const res = await sva(
    env,
    "POST",
    "/v1/agents/outbound-calls",
    {
      agent_id: env.OUTBOUND_AGENT_ID,
      to: phone,
      caller_id_number: env.CALLER_ID_NUMBER,
    },
    { "Idempotency-Key": crypto.randomUUID() },
  );
  if (!res.ok) {
    const msg = res.data?.error?.message || "The call could not be placed.";
    return json({ error: msg }, res.status === 429 ? 429 : 502);
  }
  return json({
    conversation_id: res.data.conversation_id,
    max_seconds: Number(env.MAX_CALL_SECONDS),
  });
}

async function handleCallStatus(url, env) {
  const id = url.searchParams.get("id") || "";
  const conv = await getDemoConversation(env, id);
  if (!conv) return json({ error: "not found" }, 404);
  return json({
    status: conv.status,
    started_at: conv.started_at || null,
    ended_at: conv.ended_at || null,
    duration_ms: conv.duration_ms || null,
  });
}

async function handleEndCall(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const conv = await getDemoConversation(env, String(body.conversation_id || ""));
  if (!conv) return json({ error: "not found" }, 404);
  if (conv.status === "completed" || conv.status === "failed") {
    return json({ ended: true, already: true });
  }
  const res = await endConversation(env, conv.id);
  return json({ ended: res.ok }, res.ok ? 200 : 502);
}

/* ------------------------- voice gallery + memory-bank demo endpoints --- */

// Voice catalog proxy (auth stays server-side). Cached per isolate for 1h.
let voicesCache = { at: 0, body: null };

async function handleVoices(env) {
  if (voicesCache.body && Date.now() - voicesCache.at < 60 * 60 * 1000) {
    return json(voicesCache.body);
  }
  const res = await sva(env, "GET", "/v1/agents/voices");
  if (!res.ok) return json({ error: "voice catalog unavailable" }, 502);
  const voices = (res.data?.voices || [])
    .filter((v) => v.preview_audio)
    .map((v) => ({
      id: v.id,
      name: v.display_name,
      gender: v.gender,
      locale: v.locale,
      preview: v.preview_audio,
      style: (v.tags || []).find((t) => t.startsWith("style:"))?.slice(6) || null,
    }));
  const body = { voices };
  voicesCache = { at: Date.now(), body };
  return json(body);
}

// The memory demo's per-browser identity, minted by the page.
function validIdentity(raw) {
  return /^web_[a-z0-9]{6,40}$/.test(String(raw || "")) ? raw : null;
}

async function handleMemories(url, env) {
  const identity = validIdentity(url.searchParams.get("identity"));
  if (!identity) return json({ error: "bad identity" }, 400);
  const res = await sva(env, "GET", `/v1/agents/${env.MEMORY_AGENT_ID}/memories?limit=100`);
  if (!res.ok) return json({ error: "memory list unavailable" }, 502);
  // Web sessions land as "embed_<identity>" on the platform side.
  const match = new Set([identity, `embed_${identity}`]);
  const facts = (res.data?.memories || [])
    .filter((m) => match.has(m.caller_identity))
    .map((m) => ({ fact: m.fact, created_at: m.created_at }));
  return json({ facts });
}

async function handleForget(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const identity = validIdentity(body.identity);
  if (!identity) return json({ error: "bad identity" }, 400);
  const res = await sva(
    env,
    "DELETE",
    `/v1/agents/${env.MEMORY_AGENT_ID}/memories?caller_identity=${encodeURIComponent(`embed_${identity}`)}`,
  );
  return json({ forgotten: res.ok ? res.data?.deleted ?? true : false }, res.ok ? 200 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/outbound-call" && request.method === "POST") {
      return handleOutboundCall(request, env);
    }
    if (url.pathname === "/api/call-status" && request.method === "GET") {
      return handleCallStatus(url, env);
    }
    if (url.pathname === "/api/end-call" && request.method === "POST") {
      return handleEndCall(request, env);
    }
    if (url.pathname === "/api/voices" && request.method === "GET") {
      if (!env.SPEECHIFY_API_KEY) return json({ error: "not configured" }, 503);
      return handleVoices(env);
    }
    if (url.pathname === "/api/memories" && request.method === "GET") {
      if (!env.SPEECHIFY_API_KEY) return json({ error: "not configured" }, 503);
      return handleMemories(url, env);
    }
    if (url.pathname === "/api/forget" && request.method === "POST") {
      if (!env.SPEECHIFY_API_KEY) return json({ error: "not configured" }, 503);
      return handleForget(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not found" }, 404);
    }
    return env.ASSETS.fetch(request);
  },

  // Cron backstop: end demo calls past the cap even if the tab was closed.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const maxMs = Number(env.MAX_CALL_SECONDS) * 1000;
        const now = Date.now();
        const [active, pending] = await Promise.all([
          listDemoCalls(env, "active"),
          listDemoCalls(env, "pending"),
        ]);
        const overdue = [
          ...active.filter((c) => c.started_at && now - Date.parse(c.started_at) > maxMs),
          // pending = dialing/ringing; anything pending for 15+ minutes is stuck
          ...pending.filter((c) => c.created_at && now - Date.parse(c.created_at) > 15 * 60 * 1000),
        ];
        for (const c of overdue) {
          await endConversation(env, c.id);
        }
      })(),
    );
  },
};
