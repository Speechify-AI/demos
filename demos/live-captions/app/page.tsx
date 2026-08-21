"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = "/live-captions";

type SpeechMark = {
  start_time: number;
  end_time: number;
  value: string;
};

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

// Binary search for the speech mark whose [start_time, end_time) window contains
// the current playback position (in ms). Returns -1 when no word is active
// (leading silence, gaps between words, trailing silence).
function activeIndexAt(marks: SpeechMark[], ms: number): number {
  let lo = 0;
  let hi = marks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = marks[mid];
    if (ms < m.start_time) hi = mid - 1;
    else if (ms >= m.end_time) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export default function Home() {
  const [text, setText] = useState(
    "Speechify returns a speech mark for every word it speaks, telling you " +
      "exactly when that word starts and ends in the audio. Press play and " +
      "watch each word light up in perfect sync with the voice.",
  );
  const [marks, setMarks] = useState<SpeechMark[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

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

  // Clean up any object URL + animation frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function synthesize() {
    if (!text.trim()) {
      say("Type something to speak.", "error");
      return;
    }
    setBusy(true);
    setActive(-1);
    say("Synthesizing…");

    const headers = await turnstileHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch(`${API_BASE}/api/speak`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });
    turnstile?.reset();
    setBusy(false);

    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: res.statusText }));
      say(error ?? "Synthesis failed.", "error");
      return;
    }

    const { audio, speechMarks } = (await res.json()) as {
      audio: string;
      speechMarks: SpeechMark[];
    };
    const blob = await (await fetch(`data:audio/mpeg;base64,${audio}`)).blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setMarks(speechMarks);
    setAudioUrl(URL.createObjectURL(blob));
    say(`Ready — ${speechMarks.length} words. Press play.`);
  }

  // The live-captions loop: on every animation frame while the audio plays,
  // read audio.currentTime, find the word whose window we're inside, and
  // highlight it. Same logic drops straight into a browser extension content
  // script — swap this React state for classList toggles on the page's DOM.
  function tick() {
    const audio = audioRef.current;
    if (audio) {
      const idx = activeIndexAt(marks, audio.currentTime * 1000);
      setActive((prev) => (prev === idx ? prev : idx));
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  const words = text.trim().length > 0 && marks.length > 0 ? marks : [];

  return (
    <main>
      <p className="eyebrow">SpeechifyAI · Speech marks</p>
      <h1>Live captions, driven by speech marks.</h1>
      <p className="lead">
        Synthesize any text and each word lights up the instant the voice speaks
        it — powered entirely by the <code>speech_marks</code> the SpeechifyAI
        API returns alongside the audio. No forced alignment, no manual timing.
      </p>

      <section className="step">
        <h2>Text to speak</h2>
        <textarea
          id="text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div id="turnstile-container" />
        <button className="btn btn-primary" onClick={synthesize} disabled={busy}>
          Synthesize
        </button>
      </section>

      {words.length > 0 && (
        <section className="captions" aria-live="polite">
          <p className="caption-line">
            {words.map((w, i) => (
              <span key={i} className={i === active ? "word active" : "word"}>
                {w.value}{" "}
              </span>
            ))}
          </p>
        </section>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          controls
          src={audioUrl}
          onPlay={startLoop}
          onPause={stopLoop}
          onEnded={() => {
            stopLoop();
            setActive(-1);
          }}
          onSeeked={() => {
            const audio = audioRef.current;
            if (audio) setActive(activeIndexAt(marks, audio.currentTime * 1000));
          }}
        />
      )}

      <p className="status" data-tone={tone}>
        {status}
      </p>
    </main>
  );
}
