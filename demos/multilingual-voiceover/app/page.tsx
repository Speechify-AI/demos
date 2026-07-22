"use client";

import { useEffect, useState } from "react";
import { LANGUAGES, findLanguage } from "./lib/languages";

const API_BASE = "/multilingual-voiceover";

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

interface SpeechMeta {
  voiceName: string;
  locale: string;
  model: string;
  billableCharactersCount: number | null;
}

export default function Home() {
  const [code, setCode] = useState("fr-FR");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<SpeechMeta | null>(null);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);

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

  const language = findLanguage(code);

  function say(message: string, t: "info" | "error" = "info") {
    setStatus(message);
    setTone(t);
  }

  async function generate() {
    setBusy(true);
    setAudioUrl(null);
    setMeta(null);
    say("Synthesizing with simba-3.0...");
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (turnstile) {
        const token = await turnstile.getToken();
        if (token) headers["x-turnstile-token"] = token;
      }

      const res = await fetch(`${API_BASE}/api/speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code }),
      });
      turnstile?.reset();

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as {
        audio: string;
        mediaType?: string;
        voiceName: string;
        locale: string;
        model: string;
        billableCharactersCount: number | null;
      };

      setAudioUrl(`data:${data.mediaType ?? "audio/mpeg"};base64,${data.audio}`);
      setMeta({
        voiceName: data.voiceName,
        locale: data.locale,
        model: data.model,
        billableCharactersCount: data.billableCharactersCount,
      });
      say("Done. Press play.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Multilingual voiceover with Speechify</h1>
      <p>
        Pick a language and hear the same idea spoken in it. Each language uses a{" "}
        <code>simba-3.0</code> voice for that locale, synthesized through{" "}
        <code>POST /v1/audio/speech</code>. The API key stays on the server.
      </p>

      <section className="step">
        <h2>1. Pick a language</h2>
        <label htmlFor="lang">Language (simba-3.0 locales)</label>
        <select id="lang" value={code} onChange={(e) => setCode(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} — {l.voiceName}
            </option>
          ))}
        </select>
        {language ? (
          <p className="preview" lang={language.code}>
            &ldquo;{language.text}&rdquo;
          </p>
        ) : null}
      </section>

      <section className="step">
        <h2>2. Generate the voiceover</h2>
        <div id="turnstile-container" />
        <button onClick={generate} disabled={busy}>
          {busy ? "Synthesizing..." : "Generate voiceover"}
        </button>
        <p className="status" data-tone={tone}>
          {status}
        </p>
        {audioUrl ? <audio controls src={audioUrl} /> : null}
      </section>

      {meta ? (
        <section className="step">
          <h2>3. What came back</h2>
          <ul>
            <li>
              Model: <code>{meta.model}</code>
            </li>
            <li>
              Voice: <code>{meta.voiceName}</code> (<code>{meta.locale}</code>)
            </li>
            <li>
              Billable characters: <code>{meta.billableCharactersCount ?? "unknown"}</code>
            </li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
