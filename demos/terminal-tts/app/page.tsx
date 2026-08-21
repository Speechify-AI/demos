"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = "/terminal-tts";

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

type Line = {
  id: number;
  kind: "input" | "output" | "error" | "ok";
  text: string;
};

const PROMPT = "you@speechify ~ $";

const BANNER = [
  "Speechify TTS shell — type a command and press enter.",
  'Try:  speechify say "hello world" --voice geffen_32',
  "Type  help  for the full command list.",
];

// Split a command line into argv, honoring double quotes so the spoken text can
// contain spaces. Mirrors how a real shell would tokenize `say "hello world"`.
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

// Pull `--flag value` (and `--flag=value`) pairs out of argv, returning the
// remaining positional args plus a flag map.
function parseArgs(argv: string[]): {
  positionals: string[];
  flags: Record<string, string>;
} {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[body] = argv[++i];
      } else {
        flags[body] = "true";
      }
    } else {
      positionals.push(tok);
    }
  }
  return { positionals, flags };
}

export default function Home() {
  const [lines, setLines] = useState<Line[]>(
    BANNER.map((text, i) => ({ id: i, kind: "output" as const, text })),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);

  const nextId = useRef(BANNER.length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (audioUrl) audioRef.current?.play().catch(() => {});
  }, [audioUrl]);

  function push(kind: Line["kind"], text: string) {
    setLines((prev) => [...prev, { id: nextId.current++, kind, text }]);
  }

  async function turnstileHeaders(
    base: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    if (!turnstile) return base;
    const token = await turnstile.getToken();
    if (!token) return base;
    return { ...base, "x-turnstile-token": token };
  }

  async function runSay(argv: string[]) {
    const { positionals, flags } = parseArgs(argv);
    const text = positionals.join(" ").trim();
    if (!text) {
      push("error", 'say: missing text. Usage: speechify say "your text" [--voice id] [--model id]');
      return;
    }
    const voiceId = flags.voice || flags.v;
    const model = flags.model || flags.m;

    setBusy(true);
    push(
      "output",
      `synthesizing… voice=${voiceId || "geffen_32"} model=${model || "simba-3.2"}`,
    );

    try {
      const headers = await turnstileHeaders({
        "content-type": "application/json",
      });
      const res = await fetch(`${API_BASE}/api/say`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voiceId, model }),
      });
      turnstile?.reset();

      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: res.statusText }));
        push("error", `error: ${error ?? "synthesis failed"}`);
        return;
      }

      const data = await res.json();
      const blob = await (
        await fetch(`data:audio/mpeg;base64,${data.audio}`)
      ).blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      push(
        "ok",
        `✓ played ${data.billableCharacters ?? text.length} chars with ${data.voiceId} (${data.model}). Replay below.`,
      );
    } catch {
      push("error", "error: network request failed");
    } finally {
      setBusy(false);
    }
  }

  function help() {
    [
      "Commands:",
      '  speechify say "<text>" [--voice <id>] [--model <id>]   synthesize and play',
      "  voices                                                 list voices for simba-3.2",
      "  clear                                                  clear the screen",
      "  help                                                   show this help",
      "",
      "Flags accept --flag value or --flag=value. Short forms: -v alias --voice via --v.",
      "Default voice: geffen_32   Default model: simba-3.2",
    ].forEach((l) => push("output", l));
  }

  function voices() {
    [
      "simba-3.2 voices:",
      "  geffen_32  harper_32  dominic_32  beatrice_32",
      "  wyatt_32   edmund_32  hugh_32     imogen_32",
      "Pass one with --voice, e.g. --voice harper_32.",
    ].forEach((l) => push("output", l));
  }

  async function run(raw: string) {
    const line = raw.trim();
    push("input", `${PROMPT} ${line}`);
    if (!line) return;

    setHistory((h) => [...h, line]);
    const argv = tokenize(line);
    const cmd = argv[0];

    if (cmd === "clear") {
      setLines([]);
      nextId.current = 0;
      return;
    }
    if (cmd === "help") return help();
    if (cmd === "voices") return voices();
    if (cmd === "speechify") {
      const sub = argv[1];
      if (sub === "say") return runSay(argv.slice(2));
      push("error", `speechify: unknown subcommand '${sub ?? ""}'. Try: speechify say "text"`);
      return;
    }
    push("error", `command not found: ${cmd}. Type 'help'.`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (busy) return;
      const value = input;
      setInput("");
      setHistIdx(null);
      void run(value);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(null);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  }

  return (
    <main>
      <header className="masthead">
        <p className="eyebrow">SpeechifyAI · TTS API</p>
        <h1>TTS from your terminal.</h1>
        <p className="lead">
          A terminal-styled playground for the SpeechifyAI API. Type a command
          and press enter — the browser posts it to a server route that holds the
          API key and returns audio.
        </p>
      </header>

      <div
        className="terminal"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Speechify terminal"
      >
        <div className="titlebar">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="titletext">speechify — tts</span>
        </div>
        <div className="screen" ref={scrollRef}>
          {lines.map((l) => (
            <div key={l.id} className={`line ${l.kind}`}>
              {l.text}
            </div>
          ))}
          <div className="prompt-row">
            <span className="prompt">{PROMPT}</span>
            <input
              ref={inputRef}
              className="cmd"
              value={input}
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              disabled={busy}
              placeholder={busy ? "working…" : ""}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Command input"
            />
          </div>
        </div>
      </div>

      <div className="widget">
        <div id="turnstile-container" />
      </div>

      {audioUrl && (
        <audio ref={audioRef} controls src={audioUrl} className="player" />
      )}

      <footer>
        <p>
          Prefer a real shell? This folder ships <code>cli/say.mjs</code>, a
          dependency-free Node CLI that calls the same SpeechifyAI endpoint. See
          the README.
        </p>
      </footer>
    </main>
  );
}
