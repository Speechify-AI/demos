"use client";

import { useEffect, useRef, useState } from "react";

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

type Challenge = { challengeId: string; phrase: string; expiresAt: string };

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
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [recording, setRecording] = useState(false);
  const [consent, setConsent] = useState<{ blob: Blob; url: string } | null>(null);
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

  const recorderRef = useRef<MediaRecorder | null>(null);

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

  // Leg 1: exchange the consenting person's name for a phrase to read aloud.
  async function getPhrase() {
    if (!file || !fullName.trim()) {
      say("Add a voice sample and the consenting person's name.", "error");
      return;
    }
    setBusy(true);
    say("Requesting a consent phrase…");
    const headers = await turnstileHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${API_BASE}/api/consent-challenge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ fullName }),
    });
    consumeToken();
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      say(error ?? "Could not start consent.", "error");
      return;
    }
    setChallenge(await res.json());
    setConsent(null);
    say("Record the person reading the phrase below, then clone.");
  }

  // Record the speaker reading the phrase, in the browser, via MediaRecorder.
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setConsent((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
        say("Consent recorded. You can re-record, or clone the voice.");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      say("Recording — read the phrase aloud, then press Stop.");
    } catch {
      say("Microphone access is required to record consent.", "error");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  // Leg 2: send the sample, the consent recording and the challenge id together.
  async function clone() {
    if (!file || !consent || !challenge) return;
    setBusy(true);
    say("Cloning voice…");
    const body = new FormData();
    body.append("sample", file);
    body.append(
      "consentRecording",
      new File([consent.blob], "consent.webm", { type: consent.blob.type }),
    );
    body.append("consentChallengeId", challenge.challengeId);

    const headers = await turnstileHeaders();
    const res = await fetch(`${API_BASE}/api/clone`, {
      method: "POST",
      headers,
      body,
    });
    consumeToken();
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      say(error ?? "Clone failed.", "error");
      // A consent challenge is single-use — a rejected create spends it, so
      // start the consent leg over with a fresh phrase.
      if (res.status >= 400 && res.status < 500 && res.status !== 402) {
        setChallenge(null);
        setConsent(null);
      }
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
        <div id="turnstile-container" />
        <button onClick={getPhrase} disabled={busy || tsState === "waiting"}>
          {tsState === "waiting" ? "Verifying you're human…" : "Get consent phrase"}
        </button>
      </section>

      {challenge && (
        <section className="step">
          <h2>Step 2 — record consent</h2>
          <p>
            Have <strong>the same person as the voice sample</strong> read this
            aloud, word for word:
          </p>
          <p className="phrase">{challenge.phrase}</p>
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
          >
            {recording ? "Stop recording" : consent ? "Re-record consent" : "Record consent"}
          </button>
          {consent && <audio controls src={consent.url} />}
          <button
            onClick={clone}
            disabled={busy || !consent || recording || tsState === "waiting"}
          >
            {tsState === "waiting" ? "Verifying you're human…" : "Clone voice"}
          </button>
        </section>
      )}

      <section className="step">
        <h2>Step 3 — synthesize</h2>
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
