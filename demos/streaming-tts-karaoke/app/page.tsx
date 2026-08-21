"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = "/streaming-tts-karaoke/api/stream";

const SAMPLE =
  "Streaming text to speech means you do not wait for the whole clip. " +
  "Each word arrives with its own timestamp, so the page can light it up the " +
  "moment its audio lands, and then again as it plays.";

type Token = { text: string; start: number; end: number };
type TimedMark = { idx: number; start: number; end: number };

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

// Split input into word tokens, keeping each token's character range so we can
// line marks (which address the input by char offset) up with what's rendered.
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return tokens;
}

function tokenForCharRange(tokens: Token[], start: number, end: number): number {
  // The token whose char range overlaps the mark's range.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].start < end && tokens[i].end > start) return i;
  }
  return -1;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function Home() {
  const [text, setText] = useState(SAMPLE);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [received, setReceived] = useState<Set<number>>(new Set());
  const [playingIdx, setPlayingIdx] = useState<number>(-1);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const timelineRef = useRef<TimedMark[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!window.SpeechifyTurnstile && !cancelled) await new Promise((r) => setTimeout(r, 30));
      if (!cancelled) turnstileRef.current = await window.SpeechifyTurnstile!.render("#turnstile-container");
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const say = (m: string, t: "info" | "error" = "info") => {
    setStatus(m);
    setTone(t);
  };

  // Follow playback: highlight whichever word's [start,end) contains currentTime.
  const trackPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      const t = audio.currentTime * 1000;
      const mark = timelineRef.current.find((mk) => t >= mk.start && t < mk.end);
      setPlayingIdx(mark ? mark.idx : -1);
      if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  async function speak() {
    if (busy) return;
    const input = text.trim();
    if (!input) {
      say("Type some text first.", "error");
      return;
    }

    // Reset visual state.
    const toks = tokenize(input);
    setTokens(toks);
    setReceived(new Set());
    setPlayingIdx(-1);
    timelineRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setBusy(true);
    say("Connecting…");

    // Set up streaming playback via MediaSource when supported; otherwise buffer
    // the whole clip and play it at the end (arrival highlighting still works).
    const audio = audioRef.current!;
    const canMSE =
      typeof window !== "undefined" &&
      "MediaSource" in window &&
      window.MediaSource.isTypeSupported("audio/mpeg");

    let sourceBuffer: SourceBuffer | null = null;
    const appendQueue: ArrayBuffer[] = [];
    const fallbackChunks: ArrayBuffer[] = [];
    let streamDone = false;
    let mediaSource: MediaSource | null = null;
    let started = false;

    const flush = () => {
      if (sourceBuffer && !sourceBuffer.updating && appendQueue.length) {
        sourceBuffer.appendBuffer(appendQueue.shift()!);
      }
      if (
        streamDone &&
        mediaSource &&
        mediaSource.readyState === "open" &&
        sourceBuffer &&
        !sourceBuffer.updating &&
        appendQueue.length === 0
      ) {
        try {
          mediaSource.endOfStream();
        } catch {
          /* already ended */
        }
      }
    };

    const startPlayback = () => {
      if (started) return;
      started = true;
      audio.play().then(trackPlayback).catch(() => {
        /* autoplay blocked — user can hit the native controls */
      });
    };

    if (canMSE) {
      mediaSource = new MediaSource();
      audio.src = URL.createObjectURL(mediaSource);
      await new Promise<void>((resolve) => {
        mediaSource!.addEventListener("sourceopen", () => resolve(), { once: true });
      });
      sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      sourceBuffer.addEventListener("updateend", flush);
    }

    const pushAudio = (bytes: Uint8Array) => {
      // A fresh Uint8Array is backed by a plain ArrayBuffer (never Shared).
      const ab = bytes.buffer as ArrayBuffer;
      if (canMSE) {
        appendQueue.push(ab);
        flush();
        startPlayback();
      } else {
        fallbackChunks.push(ab);
      }
    };

    try {
      const token = turnstileRef.current ? await turnstileRef.current.getToken() : null;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers["x-turnstile-token"] = token;

      const res = await fetch(API, { method: "POST", headers, body: JSON.stringify({ input }) });
      turnstileRef.current?.reset();
      if (!res.ok || !res.body) throw new Error((await res.text()) || `Request failed (${res.status})`);

      say("Streaming…");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Parse the SSE stream event-by-event as bytes arrive.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";
        for (const block of blocks) {
          const dataLine = block
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!dataLine) continue;
          let evt: {
            type?: string;
            audio?: string;
            speech_marks?: { start?: number; end?: number; start_time?: number; end_time?: number }[];
            error?: { message?: string };
          };
          try {
            evt = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (evt.type === "speech.error") {
            throw new Error(evt.error?.message || "stream error");
          }
          if (evt.speech_marks?.length) {
            setReceived((prev) => {
              const next = new Set(prev);
              for (const mk of evt.speech_marks!) {
                const idx = tokenForCharRange(toks, mk.start ?? 0, mk.end ?? 0);
                if (idx >= 0) {
                  next.add(idx);
                  timelineRef.current.push({
                    idx,
                    start: mk.start_time ?? 0,
                    end: mk.end_time ?? Number.MAX_SAFE_INTEGER,
                  });
                }
              }
              return next;
            });
          }
          if (evt.audio) pushAudio(b64ToBytes(evt.audio));
        }
      }

      streamDone = true;
      if (canMSE) {
        flush();
      } else if (fallbackChunks.length) {
        const blob = new Blob(fallbackChunks, { type: "audio/mpeg" });
        audio.src = URL.createObjectURL(blob);
        startPlayback();
      }
      say("Done — playing back.");
    } catch (err) {
      say((err as Error).message || "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">SpeechifyAI · Streaming API</p>
        <h1>Streaming TTS, word by word.</h1>
        <p className="lead">
          The streaming endpoint returns audio <em>and</em> word timestamps as it synthesizes. Each
          word lights up the instant its audio arrives over the wire, then a second highlight follows
          the actual playback. The API key stays server-side.
        </p>
      </header>

      <div className="card">
        <label htmlFor="src">Text</label>
        <textarea id="src" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </div>

      <div id="turnstile-container" />

      <div className="controls">
        <button className="btn btn-primary" onClick={speak} disabled={busy}>
          {busy ? "Streaming…" : "▶ Stream it"}
        </button>
        <div className="legend" aria-hidden>
          <span className="chip received">received</span>
          <span className="chip playing">playing</span>
        </div>
      </div>

      {status ? <p className={tone === "error" ? "status error" : "status"}>{status}</p> : null}

      <div className="stage" aria-live="polite">
        {tokens.length === 0 ? (
          <p className="hint">Hit “Stream it” and watch the words arrive.</p>
        ) : (
          <p className="words">
            {tokens.map((t, i) => (
              <span
                key={i}
                className={`w${received.has(i) ? " received" : ""}${i === playingIdx ? " playing" : ""}`}
              >
                {t.text}{" "}
              </span>
            ))}
          </p>
        )}
      </div>

      <audio ref={audioRef} controls hidden={tokens.length === 0} />

      <footer>
        <p>
          Built on <code>POST /v1/audio/stream/with-timestamps</code> (Server-Sent Events, model{" "}
          <code>simba-3.2</code>). Each <code>speech.chunk</code> carries base64 audio and/or word{" "}
          <code>speech_marks</code> with absolute-millisecond times. Playback streams in via the{" "}
          <a href="https://developer.mozilla.org/docs/Web/API/Media_Source_Extensions_API">
            MediaSource API
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
