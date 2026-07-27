"use client";

import { useEffect, useState } from "react";

const API_BASE = "/next-voice-cloning-app";

type TurnstileHandle = {
  enabled: boolean;
  getToken: (opts?: { timeout?: number }) => Promise<string | null>;
  reset: () => void;
};

// "waiting": no token yet — gated buttons stay disabled.
// "ready":   token in hand — submits go out with it attached.
// "open":    genuinely ungated client-side (no site key, script blocked,
//            widget error) — buttons enabled, requests go tokenless and the
//            server stays the authority (403s them whenever it's enforcing).
type TurnstileState = "waiting" | "ready" | "open";

declare global {
  interface Window {
    SpeechifyTurnstile?: {
      render: (
        target: string | HTMLElement,
        options?: unknown,
      ) => Promise<TurnstileHandle>;
    };
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [text, setText] = useState(
    "Hello from a voice cloned with the Speechify API.",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);
  const [tsState, setTsState] = useState<TurnstileState>("waiting");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      while (!window.SpeechifyTurnstile && !cancelled) {
        await new Promise((r) => setTimeout(r, 30));
      }
      if (cancelled) return;
      try {
        const t = await window.SpeechifyTurnstile!.render(
          "#turnstile-container",
          {
            onToken: () => setTsState("ready"),
            onExpired: () => setTsState("waiting"),
            onError: () => setTsState("open"),
          },
        );
        if (cancelled) return;
        setTurnstile(t);
        if (!t.enabled) setTsState("open");
      } catch {
        if (!cancelled) setTsState("open");
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  function say(message: string, t: "info" | "error" = "info") {
    setStatus(message);
    setTone(t);
  }

  async function turnstileHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    if (!turnstile?.enabled || tsState === "open") return base;
    const token = await turnstile.getToken();
    if (!token) return base;
    return { ...base, "x-turnstile-token": token };
  }

  function consumeToken() {
    turnstile?.reset();
    // The token was single-use; stay disabled until the re-solve lands.
    setTsState((s) => (s === "open" ? s : "waiting"));
  }

  async function clone() {
    if (!file || !fullName || !email) {
      say("Pick a sample and fill in consent name and email.", "error");
      return;
    }
    setBusy(true);
    say("Cloning voice…");
    const body = new FormData();
    body.append("sample", file);
    body.append("fullName", fullName);
    body.append("email", email);

    const headers = await turnstileHeaders();
    const res = await fetch(`${API_BASE}/api/clone`, {
      method: "POST",
      headers,
      body,
    });
    consumeToken();
    setBusy(false);
    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: res.statusText }));
      say(error ?? "Clone failed.", "error");
      return;
    }
    const { voiceId: id } = await res.json();
    setVoiceId(id);
    say(`Cloned. voice_id = ${id}`);
  }

  async function speak() {
    if (!voiceId) return;
    setBusy(true);
    say("Synthesizing…");
    const headers = await turnstileHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, voiceId }),
    });
    consumeToken();
    setBusy(false);
    if (!res.ok) {
      say("Synthesis failed.", "error");
      return;
    }
    const { audio } = await res.json();
    const blob = await (await fetch(`data:audio/mpeg;base64,${audio}`)).blob();
    setAudioUrl(URL.createObjectURL(blob));
    say("Done. Press play.");
  }

  return (
    <main>
      <h1>Clone a voice, then speak with it</h1>

      <section className="step">
        <h2>Step 1 — sample and consent</h2>
        <label htmlFor="sample">
          Voice sample (10 to 30 seconds, one speaker)
        </label>
        <input
          id="sample"
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <label htmlFor="fullName">Consenting person&apos;s full name</label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <label htmlFor="email">Consenting person&apos;s email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div id="turnstile-container" />
        <button onClick={clone} disabled={busy || tsState === "waiting"}>
          {tsState === "waiting" ? "Verifying you're human…" : "Clone voice"}
        </button>
      </section>

      <section className="step">
        <h2>Step 2 — synthesize</h2>
        <label htmlFor="text">Text to speak</label>
        <textarea
          id="text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={speak}
          disabled={busy || !voiceId || tsState === "waiting"}
        >
          {tsState === "waiting" && voiceId
            ? "Verifying you're human…"
            : "Synthesize with cloned voice"}
        </button>
        {audioUrl && <audio controls src={audioUrl} />}
      </section>

      <p className="status" data-tone={tone}>
        {status}
      </p>
    </main>
  );
}
