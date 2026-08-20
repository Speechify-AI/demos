"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = "/blog-to-podcast";
const MAX_INPUT_CHARS = 8000;

const VOICES = [
  "geffen_32",
  "harper_32",
  "dominic_32",
  "beatrice_32",
  "wyatt_32",
  "edmund_32",
  "hugh_32",
  "imogen_32",
];

const SAMPLE_ARTICLE = `The best APIs disappear.

You reach for one when you have a job to do, and the good ones let you finish the job without ever thinking about the API again. That is the whole trick. A text-to-speech API is no different: paste some words, get back audio that sounds like a person actually said them.

For years, machine narration announced itself. The flat cadence, the wrong stress on the wrong syllable, the little digital exhale between sentences. You always knew. Modern models close that gap, and the interesting work moves up a level — from "can it talk" to "does it sound like a host".

That is what this demo is about. Take a long article, the kind you would actually read, and turn it into an episode you would actually listen to.`;

type Chunk = { audio: string; text: string };

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
  const [text, setText] = useState(SAMPLE_ARTICLE);
  const [hostVoice, setHostVoice] = useState("geffen_32");
  const [guestVoice, setGuestVoice] = useState("none");
  const [intro, setIntro] = useState(true);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);
  const [tsState, setTsState] = useState<TurnstileState>("waiting");

  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Revoke object URLs when they are replaced or the page unmounts.
  useEffect(() => {
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [urls]);

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
    setTsState((s) => (s === "open" ? s : "waiting"));
  }

  function b64ToBlob(b64: string): Blob {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: "audio/mpeg" });
  }

  async function generate() {
    if (!text.trim()) {
      say("Paste an article first.", "error");
      return;
    }
    // Tear down any previous episode.
    urls.forEach((u) => URL.revokeObjectURL(u));
    setUrls([]);
    setChunks([]);
    setCurrent(-1);
    setPlaying(false);

    setBusy(true);
    say("Generating episode… this synthesizes each chunk in turn.");
    const headers = await turnstileHeaders({ "Content-Type": "application/json" });
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/episode`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          hostVoice,
          guestVoice: guestVoice === "none" ? undefined : guestVoice,
          intro,
        }),
      });
    } catch {
      consumeToken();
      setBusy(false);
      say("Network error.", "error");
      return;
    }
    consumeToken();
    setBusy(false);
    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: res.statusText }));
      say(error ?? "Generation failed.", "error");
      return;
    }
    const { chunks: got } = (await res.json()) as { chunks: Chunk[] };
    const newUrls = got.map((c) => URL.createObjectURL(b64ToBlob(c.audio)));
    setChunks(got);
    setUrls(newUrls);
    say(`Episode ready — ${got.length} segment(s). Press play.`);
  }

  // Seamless queue: when one segment ends, advance to the next.
  function playFrom(index: number) {
    if (index < 0 || index >= urls.length) return;
    setCurrent(index);
    setPlaying(true);
    const el = audioRef.current;
    if (el) {
      el.src = urls[index];
      void el.play().catch(() => setPlaying(false));
    }
  }

  function onEnded() {
    if (current + 1 < urls.length) {
      playFrom(current + 1);
    } else {
      setPlaying(false);
      setCurrent(-1);
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else if (current >= 0) {
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    } else {
      playFrom(0);
    }
  }

  // Naive concatenation of the mp3 segment blobs into one file. Good enough for
  // a demo download; noted as naive in the README.
  function download() {
    if (urls.length === 0) return;
    const blob = new Blob(
      chunks.map((c) => b64ToBlob(c.audio)),
      { type: "audio/mpeg" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "episode.mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const over = text.length > MAX_INPUT_CHARS;

  return (
    <main>
      <h1>Turn a blog post into a podcast episode</h1>
      <p className="lede">
        Paste a long-form article. Speechify chunks it on sentence boundaries and
        narrates each chunk with the TTS API, then it plays back-to-back as one
        continuous episode.
      </p>

      <section className="step">
        <h2>Step 1 — the article</h2>
        <label htmlFor="text">Article text (plain text or simple markdown)</label>
        <textarea
          id="text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="count" data-over={over}>
          {text.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}{" "}
          characters {over ? "— over the demo cap" : ""}
        </p>
      </section>

      <section className="step">
        <h2>Step 2 — voices</h2>
        <label htmlFor="host">Host voice</label>
        <select
          id="host"
          value={hostVoice}
          onChange={(e) => setHostVoice(e.target.value)}
        >
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <label htmlFor="guest">
          Guest voice (optional — alternates per paragraph)
        </label>
        <select
          id="guest"
          value={guestVoice}
          onChange={(e) => setGuestVoice(e.target.value)}
        >
          <option value="none">None (single narrator)</option>
          {VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <label className="check">
          <input
            type="checkbox"
            checked={intro}
            onChange={(e) => setIntro(e.target.checked)}
          />
          Prepend a short episode intro
        </label>

        <div id="turnstile-container" />
        <button
          onClick={generate}
          disabled={busy || over || tsState === "waiting"}
        >
          {busy
            ? "Generating…"
            : tsState === "waiting"
              ? "Verifying you're human…"
              : "Generate episode"}
        </button>
      </section>

      {chunks.length > 0 && (
        <section className="step">
          <h2>Step 3 — the episode</h2>
          <div className="player">
            <button className="playbtn" onClick={togglePlay}>
              {playing ? "Pause" : current >= 0 ? "Resume" : "Play episode"}
            </button>
            <button className="ghost" onClick={download}>
              Download episode
            </button>
          </div>
          <ol className="playlist">
            {chunks.map((c, i) => (
              <li
                key={i}
                data-active={i === current}
                onClick={() => playFrom(i)}
              >
                <span className="idx">{i + 1}</span>
                <span className="snippet">
                  {c.text.length > 90 ? `${c.text.slice(0, 90)}…` : c.text}
                </span>
              </li>
            ))}
          </ol>
          {/* Hidden driver element; the playlist is the UI. */}
          <audio
            ref={audioRef}
            onEnded={onEnded}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            hidden
          />
        </section>
      )}

      <p className="status" data-tone={tone}>
        {status}
      </p>
    </main>
  );
}
