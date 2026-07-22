"use client";

import { useEffect, useState } from "react";

const API_BASE = "/ai-sdk-speechify-speech";

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

interface VoiceOption {
  id: string;
  display_name: string;
  gender?: string | null;
}

interface SpeechMeta {
  warnings: unknown[];
  billableCharactersCount: number | null;
  audioFormat: string | null;
}

export default function Home() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceId] = useState("harper_32");
  const [text, setText] = useState(
    "The AI SDK calls this provider, the provider calls Speechify, and the key never leaves the server.",
  );
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

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/voices`)
      .then((r) => r.json())
      .then((data: { voices?: VoiceOption[] }) => {
        if (!cancelled && data.voices?.length) setVoices(data.voices);
      })
      .catch(() => {
        /* the select keeps its default option */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function say(message: string, t: "info" | "error" = "info") {
    setStatus(message);
    setTone(t);
  }

  async function generate() {
    if (!text.trim()) {
      say("Type something to synthesize.", "error");
      return;
    }
    setBusy(true);
    setMeta(null);
    say("Generating speech via generateSpeech()...");
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
        body: JSON.stringify({ text, voiceId }),
      });
      turnstile?.reset();

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as {
        audio: string;
        mediaType?: string;
        warnings?: unknown[];
        providerMetadata?: {
          speechify?: {
            billableCharactersCount?: number | null;
            audioFormat?: string | null;
          };
        };
      };

      const mediaType = data.mediaType ?? "audio/mpeg";
      setAudioUrl(`data:${mediaType};base64,${data.audio}`);
      setMeta({
        warnings: data.warnings ?? [],
        billableCharactersCount:
          data.providerMetadata?.speechify?.billableCharactersCount ?? null,
        audioFormat: data.providerMetadata?.speechify?.audioFormat ?? null,
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
      <h1>Speech generation with the AI SDK and Speechify</h1>
      <p>
        The page below calls a Next.js route that runs the AI SDK&apos;s{" "}
        <code>generateSpeech()</code> with a custom Speechify speech model.
        The model is <code>simba-3.2</code>; the voices are its registered
        voice list, fetched from <code>GET /v1/voices</code> server-side.
      </p>

      <section className="step">
        <h2>1. Pick a voice</h2>
        <label htmlFor="voice">Voice (simba-3.2 registered voices)</label>
        <select
          id="voice"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
        >
          {(voices.length
            ? voices
            : [{ id: "harper_32", display_name: "harper_32" }]
          ).map((v) => (
            <option key={v.id} value={v.id}>
              {v.display_name}
              {v.gender ? ` (${v.gender})` : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="step">
        <h2>2. Generate speech</h2>
        <label htmlFor="text">Text</label>
        <textarea
          id="text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div id="turnstile-container" />
        <button onClick={generate} disabled={busy}>
          {busy ? "Generating..." : "Generate with generateSpeech()"}
        </button>
        <p className="status" data-tone={tone}>
          {status}
        </p>
        {audioUrl ? <audio controls src={audioUrl} /> : null}
      </section>

      {meta ? (
        <section className="step">
          <h2>3. What came back</h2>
          <p>
            <code>result.providerMetadata.speechify</code> carries the fields
            the endpoint returns beyond the audio itself.
          </p>
          <ul>
            <li>
              Audio format: <code>{meta.audioFormat ?? "unknown"}</code>
            </li>
            <li>
              Billable characters:{" "}
              <code>{meta.billableCharactersCount ?? "unknown"}</code>
            </li>
            <li>
              Warnings: <code>{meta.warnings.length}</code>
              {meta.warnings.length > 0 ? (
                <pre>{JSON.stringify(meta.warnings, null, 2)}</pre>
              ) : null}
            </li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
