"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE, type AgentEvent } from "./sample-events";

type TurnstileHandle = {
  getToken: (opts?: { timeout?: number }) => Promise<string | null>;
  reset: () => void;
};

declare global {
  interface Window {
    SpeechifyTurnstile?: {
      render: (target: string | HTMLElement, options?: unknown) => Promise<TurnstileHandle>;
    };
  }
}

// Group event types into colour buckets for the timeline rail.
function bucket(type: string): string {
  if (type.startsWith("session")) return "session";
  if (type.startsWith("user")) return "user";
  if (type.startsWith("tool")) return "tool";
  if (type.startsWith("agent")) return "agent";
  return "other";
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

export default function Home() {
  const [mode, setMode] = useState<"sample" | "live">("sample");
  const turnstileRef = useRef<TurnstileHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!window.SpeechifyTurnstile && !cancelled) await new Promise((r) => setTimeout(r, 30));
      if (!cancelled) turnstileRef.current = await window.SpeechifyTurnstile!.render("#turnstile-container");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <header>
        <p className="eyebrow">Speechify · Voice Agents API</p>
        <h1>Voice agent events inspector</h1>
        <p className="lead">
          A debug timeline for a voice-agent call. Replay a sample realtime event stream, or point
          it at one of your own conversations by id. The workspace API key stays server-side.
        </p>
      </header>

      <div className="tabs">
        <button className={mode === "sample" ? "on" : ""} onClick={() => setMode("sample")}>
          Replay sample stream
        </button>
        <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>
          Inspect a conversation
        </button>
      </div>

      {mode === "sample" ? <SampleReplay /> : <LiveInspect turnstileRef={turnstileRef} />}

      <div id="turnstile-container" />

      <footer>
        <p>
          Built on the{" "}
          <a href="https://docs.speechify.ai">Voice Agents API</a> — conversations are read via{" "}
          <code>GET /v1/agents/conversations/&#123;id&#125;</code>. The sample stream is
          illustrative; confirm live event field names against the docs.
        </p>
      </footer>
    </main>
  );
}

function EventRow({ e, active }: { e: AgentEvent; active: boolean }) {
  const [open, setOpen] = useState(false);
  const summary =
    (e.data?.text as string) ||
    (e.data?.name ? `${e.data.name}(${JSON.stringify(e.data.arguments ?? {})})` : "") ||
    (e.data?.reason as string) ||
    "";
  return (
    <li className={`evt ${bucket(e.type)} ${active ? "active" : ""}`}>
      <span className="t">{fmt(e.t)}</span>
      <span className="type">{e.type}</span>
      <span className="summary" title={summary}>
        {summary}
      </span>
      {e.data ? (
        <button className="peek" onClick={() => setOpen((v) => !v)}>
          {open ? "−" : "{ }"}
        </button>
      ) : null}
      {open && e.data ? <pre className="json">{JSON.stringify(e.data, null, 2)}</pre> : null}
    </li>
  );
}

function SampleReplay() {
  const events = SAMPLE.events;
  const total = SAMPLE.duration_ms;
  const [playhead, setPlayhead] = useState(total); // start fully shown
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) * speed;
      last.current = now;
      setPlayhead((p) => {
        const next = p + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, total]);

  const shown = useMemo(() => events.filter((e) => e.t <= playhead), [events, playhead]);
  const lastShown = shown[shown.length - 1];

  function restart() {
    setPlayhead(0);
    setPlaying(true);
  }

  return (
    <section className="panel">
      <div className="meta">
        <code>{SAMPLE.id}</code>
        <span className="pill">{SAMPLE.status}</span>
        <span>{fmt(playhead)} / {fmt(total)}</span>
      </div>
      <div className="controls">
        <button
          className="btn btn-primary"
          onClick={() => (playhead >= total ? restart() : setPlaying((v) => !v))}
        >
          {playing ? "▮▮ Pause" : playhead >= total ? "↻ Replay" : "▶ Play"}
        </button>
        <label>
          speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <input
          type="range"
          min={0}
          max={total}
          value={Math.round(playhead)}
          onChange={(e) => {
            setPlaying(false);
            setPlayhead(Number(e.target.value));
          }}
        />
      </div>
      <ul className="timeline">
        {shown.map((e, i) => (
          <EventRow key={i} e={e} active={e === lastShown && playing} />
        ))}
      </ul>
    </section>
  );
}

function LiveInspect({ turnstileRef }: { turnstileRef: React.RefObject<TurnstileHandle | null> }) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conv, setConv] = useState<Record<string, unknown> | null>(null);

  async function load() {
    setBusy(true);
    setError("");
    setConv(null);
    try {
      const t = turnstileRef.current;
      const token = t ? await t.getToken() : null;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers["x-turnstile-token"] = token;
      const res = await fetch("/agent-events-inspector/api/conversation", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: id.trim() || undefined }),
      });
      t?.reset();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setConv(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Defensive: the events/transcript array field name may vary — render whichever exists.
  const conversation = (conv?.conversation as Record<string, unknown>) ?? conv ?? null;
  const events =
    (conversation?.events as AgentEvent[]) ||
    (conversation?.transcript as AgentEvent[]) ||
    (conversation?.turns as AgentEvent[]) ||
    (conversation?.messages as AgentEvent[]) ||
    null;

  return (
    <section className="panel">
      <div className="live-input">
        <input
          type="text"
          value={id}
          placeholder="conv_… (leave blank to list recent conversations)"
          onChange={(e) => setId(e.target.value)}
        />
        <button className="btn btn-primary" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Fetch"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {conversation ? (
        <>
          <div className="meta">
            {typeof conversation.id === "string" ? <code>{conversation.id}</code> : null}
            {typeof conversation.status === "string" ? (
              <span className="pill">{conversation.status}</span>
            ) : null}
            {typeof conversation.duration_ms === "number" ? (
              <span>{fmt(conversation.duration_ms)}</span>
            ) : null}
          </div>
          {events && Array.isArray(events) ? (
            <ul className="timeline">
              {events.map((e, i) => (
                <EventRow key={i} e={{ t: e.t ?? 0, type: e.type ?? "event", data: (e as AgentEvent).data ?? (e as Record<string, unknown>) }} active={false} />
              ))}
            </ul>
          ) : (
            <pre className="json raw">{JSON.stringify(conv, null, 2)}</pre>
          )}
        </>
      ) : (
        <p className="hint">
          Enter a conversation id from your workspace, or leave it blank to list recent
          conversations. Nothing to inspect yet? Use the sample stream tab.
        </p>
      )}
    </section>
  );
}
