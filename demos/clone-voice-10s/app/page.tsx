"use client";

import { useEffect, useState } from "react";

const API_BASE = "/clone-voice-10s";

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
  const [file, setFile] = useState<File | null>(null);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [text, setText] = useState(
    "This voice was cloned from a ten second sample, then removed straight after.",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
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

  function say(message: string, t: "info" | "error" = "info") {
    setStatus(message);
    setTone(t);
  }

  async function turnstileHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    if (!turnstile) return base;
    const token = await turnstile.getToken();
    if (!token) return base;
    return { ...base, "x-turnstile-token": token };
  }

  // The whole point of the demo: clone → speak → delete, in one click, so the
  // clone never lingers in the workspace.
  async function run() {
    if (!file) {
      say("Pick a ~10 second WAV sample first.", "error");
      return;
    }
    if (!consent) {
      say("Tick the consent box before cloning.", "error");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      say("Add the consenting person's full name and email.", "error");
      return;
    }

    setBusy(true);
    setAudioUrl(null);
    setDeleted(false);
    setVoiceId(null);

    // 1. Clone
    say("Cloning the voice from your sample…");
    const body = new FormData();
    body.append("sample", file);
    body.append("fullName", fullName.trim());
    body.append("email", email.trim());
    body.append("gender", gender);
    body.append("consent", "true");

    const cloneRes = await fetch(`${API_BASE}/api/clone`, {
      method: "POST",
      headers: await turnstileHeaders(),
      body,
    });
    turnstile?.reset();
    if (!cloneRes.ok) {
      const { error } = await cloneRes
        .json()
        .catch(() => ({ error: cloneRes.statusText }));
      say(error ?? "Clone failed.", "error");
      setBusy(false);
      return;
    }
    const { voiceId: id } = await cloneRes.json();
    setVoiceId(id);

    // 2. Speak with the clone
    say(`Cloned (${id}). Synthesizing with the clone…`);
    const speakRes = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers: await turnstileHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text, voiceId: id }),
    });
    turnstile?.reset();

    let synthOk = false;
    if (speakRes.ok) {
      const { audio } = await speakRes.json();
      const blob = await (
        await fetch(`data:audio/mpeg;base64,${audio}`)
      ).blob();
      setAudioUrl(URL.createObjectURL(blob));
      synthOk = true;
    }

    // 3. Auto-delete the clone so the demo doesn't litter the workspace
    say("Deleting the cloned voice…");
    const delRes = await fetch(`${API_BASE}/api/voice?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: await turnstileHeaders(),
    });
    turnstile?.reset();
    if (delRes.ok) setDeleted(true);

    setBusy(false);
    if (!synthOk) {
      say("Cloned and deleted, but synthesis failed. Try again.", "error");
      return;
    }
    say(
      delRes.ok
        ? "Done. Press play — the clone has been deleted from your workspace."
        : "Synthesized. Press play. (Delete failed — remove the clone manually.)",
      delRes.ok ? "info" : "error",
    );
  }

  return (
    <main>
      <p className="eyebrow">SpeechifyAI · Voice cloning</p>
      <h1>Clone a voice from 10 seconds.</h1>
      <p className="lead">
        Zero-shot cloning from a short sample, used immediately to synthesize —
        then the clone is deleted straight after. Cloning only runs once you
        confirm consent.
      </p>

      <section className="step">
        <h2>Step 1 — sample</h2>
        <label htmlFor="sample">Voice sample</label>
        <input
          id="sample"
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="hint">
          A 10 to 30 second WAV of one speaker works best. Aim for ~10 seconds of
          clean, single-speaker audio. No sample? Use{" "}
          <code>fixtures/spacewalk.wav</code> from this repo.
        </p>
        <label htmlFor="gender">Speaker</label>
        <select
          id="gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as "male" | "female")}
        >
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
      </section>

      <section className="step">
        <h2>Step 2 — consent</h2>
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
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>I have the speaker&apos;s consent to clone this voice.</span>
        </label>
        <p className="hint">
          SpeechifyAI verifies consent on cloning. Read{" "}
          <a
            href="https://speechify.ai/voice-cloning/consent-and-safety"
            target="_blank"
            rel="noreferrer"
          >
            Voice Cloning Consent and Safety
          </a>
          .
        </p>
      </section>

      <section className="step">
        <h2>Step 3 — synthesize &amp; clean up</h2>
        <label htmlFor="text">Text to speak with the clone</label>
        <textarea
          id="text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div id="turnstile-container" />
        <button className="btn btn-primary" onClick={run} disabled={busy || !consent}>
          Clone, speak, then delete
        </button>
        {audioUrl && <audio controls src={audioUrl} />}
        {voiceId && (
          <p className="hint">
            voice_id <code>{voiceId}</code>{" "}
            {deleted ? "— deleted from your workspace." : ""}
          </p>
        )}
      </section>

      <p className="status" data-tone={tone}>
        {status}
      </p>
    </main>
  );
}
