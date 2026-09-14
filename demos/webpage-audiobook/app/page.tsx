"use client";

import { useEffect, useRef, useState } from "react";

const BASE_PATH = "/webpage-audiobook";

type Chunk = { audio: string; text: string };
type State = "idle" | "loading" | "ready" | "playing" | "error";

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
  const [url, setUrl] = useState("https://en.wikipedia.org/wiki/Text-to-speech");
  const [title, setTitle] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [current, setCurrent] = useState(-1);
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

  // Play the chunks in sequence, so the whole article reads as one audiobook.
  function playFrom(i: number) {
    if (i >= chunks.length) {
      setState("ready");
      setCurrent(-1);
      return;
    }
    setCurrent(i);
    setState("playing");
    const el = audioRef.current!;
    el.src = `data:audio/mpeg;base64,${chunks[i].audio}`;
    el.onended = () => playFrom(i + 1);
    void el.play();
  }

  async function convert() {
    if (!url.trim() || state === "loading") return;
    setState("loading");
    setError("");
    setChunks([]);
    setTitle("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = turnstileRef.current ? await turnstileRef.current.getToken() : null;
      turnstileRef.current?.reset();
      if (token) headers["x-turnstile-token"] = token;

      const res = await fetch(`${BASE_PATH}/api/audiobook`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as { title: string; truncated: boolean; chunks: Chunk[] };
      setTitle(data.title);
      setTruncated(data.truncated);
      setChunks(data.chunks);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">SpeechifyAI · Webpage to audiobook</p>
        <h1>Turn any webpage into an audiobook.</h1>
        <p className="lead">
          Paste a URL. The server fetches the article, pulls out the readable text, splits it on
          sentence boundaries, and narrates each part with the Speechify TTS API. Press play and it
          reads straight through.
        </p>
      </header>

      <div className="step">
        <h2>Article URL</h2>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
        />
      </div>

      <div id="turnstile-container" />

      <div className="play">
        <button onClick={convert} disabled={state === "loading"} className="btn btn-primary">
          {state === "loading" ? "Fetching and synthesizing…" : "Convert to audiobook"}
        </button>
        {chunks.length > 0 ? (
          <button onClick={() => playFrom(0)} className="btn">
            {state === "playing" ? "Playing" : "Play"}
          </button>
        ) : null}
        <audio ref={audioRef} hidden />
        {error ? <p className="err">{error}</p> : null}
      </div>

      {title ? (
        <div className="result">
          <h2>{title}</h2>
          <p className="meta">
            {chunks.length} segment{chunks.length === 1 ? "" : "s"}
            {truncated ? " (long article, narrating the first part)" : ""}
          </p>
          <ol>
            {chunks.map((c, i) => (
              <li key={i} className={i === current ? "active" : undefined}>
                {c.text.slice(0, 140)}
                {c.text.length > 140 ? "…" : ""}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <footer>
        <p>
          Extraction here is deliberately naive (dependency-free). A production build would use a
          real readability extractor. The Speechify API key stays server-side.
        </p>
      </footer>
    </main>
  );
}
