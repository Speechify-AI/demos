"use client";

import { useEffect, useRef, useState } from "react";
import { SpeechifyVoice } from "../components/SpeechifyVoice";

// Curated simba-3.2 voices. Browse the full catalog at platform.speechify.ai.
const VOICES = ["geffen_32", "harper_32", "dominic_32", "beatrice_32", "wyatt_32"];

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
  const [text, setText] = useState("Adding a voice to a React app takes about ten lines.");
  const [voiceId, setVoiceId] = useState(VOICES[0]);
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

  async function getToken() {
    const t = turnstileRef.current;
    if (!t) return null;
    const token = await t.getToken();
    t.reset();
    return token;
  }

  return (
    <main>
      <header>
        <h1>Voice in a React app</h1>
        <p className="lead">
          One component, <code>&lt;SpeechifyVoice&gt;</code>, turns any text into speech. The API
          key stays on the server — the button just calls your own route handler.
        </p>
      </header>

      <div className="step">
        <h2>Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </div>

      <div className="step">
        <h2>Voice</h2>
        <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div id="turnstile-container" />

      <div className="play">
        <SpeechifyVoice text={text} voiceId={voiceId} getToken={getToken} />
      </div>

      <footer>
        <p>
          The star of the demo is{" "}
          <code>components/SpeechifyVoice.tsx</code> — copy it into your own app. Pairs with the
          Speechify guide{" "}
          <a href="https://speechify.ai/blog/building-an-ai-voice-cloning-web-app-with-nextjs-and-speechify">
            Building an AI voice cloning web app with Next.js
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
