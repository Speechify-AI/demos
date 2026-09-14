"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = "/edge-tts";

type TurnstileHandle = {
  enabled: boolean;
  getToken: (opts?: { timeout?: number }) => Promise<string | null>;
  reset: () => void;
};

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
  const [text, setText] = useState(
    "This audio is streaming out of a single serverless edge function.",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      while (!window.SpeechifyTurnstile && !cancelled) {
        await new Promise((r) => setTimeout(r, 30));
      }
      if (cancelled) return;
      const t = await window.SpeechifyTurnstile!.render("#turnstile-container");
      if (!cancelled) setTurnstile(t);
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

  async function play() {
    if (!text.trim()) {
      say("Type something to speak.", "error");
      return;
    }
    setBusy(true);
    say("Streaming from the edge…");

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (turnstile) {
      const token = await turnstile.getToken();
      if (token) headers["x-turnstile-token"] = token;
    }

    const res = await fetch(`${API_BASE}/api/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: text }),
    });
    turnstile?.reset();

    if (!res.ok) {
      setBusy(false);
      const detail = await res.text().catch(() => res.statusText);
      say(detail || "Stream failed.", "error");
      return;
    }

    // Read the streamed response as a blob and play it.
    const blob = await res.blob();
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    const url = URL.createObjectURL(blob);
    lastUrl.current = url;
    setAudioUrl(url);
    setBusy(false);
    say("Done. Press play.");
  }

  return (
    <main>
      <div>
        <p className="eyebrow">SpeechifyAI · Edge TTS</p>
        <h1>One-file serverless edge TTS.</h1>
      </div>
      <p className="lead">
        Type text, hit play. The audio streams out of a single edge function at{" "}
        <code>app/api/stream/route.ts</code> — no SDK, key held server-side.
      </p>

      <section className="step">
        <label htmlFor="text">Text to speak</label>
        <textarea
          id="text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div id="turnstile-container" />
        <button
          className="btn btn-primary"
          onClick={play}
          disabled={busy}
          style={{ marginTop: "0.9rem" }}
        >
          {busy ? "Streaming…" : "Play"}
        </button>
        {audioUrl && <audio controls autoPlay src={audioUrl} />}
      </section>

      <p className="status" data-tone={tone}>
        {status}
      </p>
    </main>
  );
}
