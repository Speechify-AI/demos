"use client";

import { useEffect, useRef, useState } from "react";

// Six languages wired up, each with a voice native to that locale. simba-3.0
// officially supports these; the catalogue carries 30+ more. Browse them at
// platform.speechify.ai. To add a language: find a voice for the locale and
// add a row here (and to ALLOWED_LANGUAGES in app/api/speak/route.ts).
const LANGUAGES = [
  { code: "en-US", label: "English", voiceId: "alfonso", sample: "Hello. This is Speechify reading in English." },
  { code: "de-DE", label: "German", voiceId: "amalia", sample: "Hallo. Das ist Speechify auf Deutsch." },
  { code: "es-MX", label: "Spanish", voiceId: "aitana", sample: "Hola. Esto es Speechify en español." },
  { code: "fr-FR", label: "French", voiceId: "adeline", sample: "Bonjour. Voici Speechify en français." },
  { code: "it-IT", label: "Italian", voiceId: "alessia", sample: "Ciao. Questo è Speechify in italiano." },
  { code: "pt-BR", label: "Portuguese (Brazil)", voiceId: "adriana", sample: "Olá. Este é o Speechify em português." },
] as const;

// This app is mounted under a basePath (see next.config.ts), so the route
// handler lives at `${BASE_PATH}/api/speak`. Client fetches are not basePath-aware.
const BASE_PATH = "/multilingual-tts";

type State = "idle" | "loading" | "playing" | "error";

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

export default function Home() {
  const [code, setCode] = useState<(typeof LANGUAGES)[number]["code"]>("fr-FR");
  const lang = LANGUAGES.find((l) => l.code === code)!;
  const [text, setText] = useState<string>(lang.sample);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnstileRef = useRef<TurnstileHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!window.SpeechifyTurnstile && !cancelled) {
        await new Promise((r) => setTimeout(r, 30));
      }
      if (cancelled) return;
      turnstileRef.current = await window.SpeechifyTurnstile!.render("#turnstile-container");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickLanguage(next: (typeof LANGUAGES)[number]["code"]) {
    const prev = LANGUAGES.find((l) => l.code === code)!;
    const nextLang = LANGUAGES.find((l) => l.code === next)!;
    setCode(next);
    // Swap the sample only if the user hasn't typed their own text.
    if (text === prev.sample || text.trim() === "") setText(nextLang.sample);
  }

  async function speak() {
    if (!text.trim() || state === "loading") return;
    setState("loading");
    setError("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = turnstileRef.current ? await turnstileRef.current.getToken() : null;
      turnstileRef.current?.reset();
      if (token) headers["x-turnstile-token"] = token;

      const res = await fetch(`${BASE_PATH}/api/speak`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voiceId: lang.voiceId, language: lang.code }),
      });
      if (!res.ok) throw new Error(await res.text());

      const { audio } = (await res.json()) as { audio: string };
      const el = audioRef.current!;
      el.src = `data:audio/mpeg;base64,${audio}`;
      el.onended = () => setState("idle");
      await el.play();
      setState("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">SpeechifyAI · Multilingual TTS</p>
        <h1>Text-to-speech in 30+ languages.</h1>
        <p className="lead">
          One request, one <code>language</code> parameter. Pick a language below and hear it in a
          voice native to that locale, synthesized by <code>simba-3.0</code>. The API key stays on
          the server.
        </p>
      </header>

      <div className="step">
        <h2>Language</h2>
        <select value={code} onChange={(e) => pickLanguage(e.target.value as typeof code)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} ({l.code})
            </option>
          ))}
        </select>
      </div>

      <div className="step">
        <h2>Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </div>

      <div id="turnstile-container" />

      <div className="play">
        <button onClick={speak} disabled={state === "loading"} className="btn btn-primary">
          {state === "loading" ? "Synthesizing…" : state === "playing" ? "Playing" : state === "error" ? "Retry" : "Speak"}
        </button>
        <audio ref={audioRef} hidden />
        {error ? <p className="err">{error}</p> : null}
      </div>

      <footer>
        <p>
          The whole feature is the <code>language</code> field on{" "}
          <code>POST /v1/audio/speech</code>. Companion to{" "}
          <a href="https://speechify.ai/blog/multilingual-voiceover-with-speechify-and-simba-3-0">
            Multilingual voiceover with the Speechify API and simba-3.0
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
