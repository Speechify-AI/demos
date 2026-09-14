"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "/ivr-ssml";

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

type Mode = "plain" | "ssml";

interface Preset {
  id: string;
  label: string;
  // The one SSML feature this preset is teaching.
  teaches: string;
  // What to notice when you flip plain -> ssml.
  hint: string;
  plain: string;
  ssml: string;
}

// Four realistic IVR lines. Each has a PLAIN version (what a naive TTS call
// sends) and an SSML version (what you'd actually ship). Flip the toggle and
// listen for the difference.
const PRESETS: Preset[] = [
  {
    id: "name",
    label: "Caller name",
    teaches: "<sub alias=\"...\">",
    hint: "Plain guesses the vowels in “Siobhan”. <sub> swaps in how it should actually be said: shiv-AWN.",
    plain: "Thanks, Siobhan. Connecting you to an agent now.",
    ssml: `<speak>
  Thanks, <sub alias="shiv-AWN">Siobhan</sub>. Connecting you to an agent now.
</speak>`,
  },
  {
    id: "number",
    label: "Account number",
    teaches: "<sub alias=\"...\">",
    hint: "Plain may read it as a quantity. <sub> spells the digits out so callers can write them down, with a pause between the groups.",
    plain: "Your account number is 4029 5567. Please have it ready.",
    ssml: `<speak>
  Your account number is
  <sub alias="four zero two nine">4029</sub>
  <break time="500ms"/>
  <sub alias="five five six seven">5567</sub>.
  <break time="300ms"/>
  Please have it ready.
</speak>`,
  },
  {
    id: "brand",
    label: "Product / brand term",
    teaches: "<sub alias=\"...\">",
    hint: "Plain mangles the run-together brand. <sub> swaps in how it should be said: Acme Cloud Pro.",
    plain: "Welcome to AcmeCloudPro. Your Premier Plus plan is active.",
    ssml: `<speak>
  Welcome to <sub alias="Acme Cloud Pro">AcmeCloudPro</sub>.
  Your Premier Plus plan is active.
</speak>`,
  },
  {
    id: "menu",
    label: "Menu line",
    teaches: "<prosody> + <break>",
    hint: "Plain rattles the options together. Slower prosody plus breaks give callers time to choose.",
    plain:
      "For billing, press one. For technical support, press two. To repeat this menu, press nine.",
    ssml: `<speak>
  <prosody rate="slow">
    For billing, press one.
    <break time="600ms"/>
    For technical support, press two.
    <break time="600ms"/>
    To repeat this menu, press nine.
  </prosody>
</speak>`,
  },
];

export default function Home() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [mode, setMode] = useState<Mode>("ssml");
  // The SSML textarea is editable per preset; keep an override map so edits
  // survive switching presets and back.
  const [ssmlEdits, setSsmlEdits] = useState<Record<string, string>>({});

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [billable, setBillable] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);

  const [turnstile, setTurnstile] = useState<TurnstileHandle | null>(null);
  const [tsState, setTsState] = useState<TurnstileState>("waiting");

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) ?? PRESETS[0],
    [presetId],
  );
  const ssmlValue = ssmlEdits[presetId] ?? preset.ssml;
  const activeInput = mode === "ssml" ? ssmlValue : preset.plain;

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

  function resetSsml() {
    setSsmlEdits((prev) => {
      const next = { ...prev };
      delete next[presetId];
      return next;
    });
  }

  async function synthesize() {
    if (!activeInput.trim()) {
      say("Nothing to synthesize.", "error");
      return;
    }
    setBusy(true);
    setBillable(null);
    say(`Synthesizing the ${mode === "ssml" ? "SSML" : "plain"} version…`);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (turnstile?.enabled && tsState !== "open") {
        const token = await turnstile.getToken();
        if (token) headers["x-turnstile-token"] = token;
      }

      const res = await fetch(`${API_BASE}/api/speak`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input: activeInput }),
      });
      turnstile?.reset();
      setTsState((s) => (s === "open" ? s : "waiting"));

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as {
        audio: string;
        billableCharactersCount?: number | null;
      };
      setAudioUrl(`data:audio/mpeg;base64,${data.audio}`);
      setBillable(data.billableCharactersCount ?? null);
      say("Done. Press play.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div>
        <p className="eyebrow">SpeechifyAI · SSML API</p>
        <h1>Nail IVR pronunciation with SSML.</h1>
      </div>
      <p className="lead">
        A phone system reads names, account numbers, and product terms out loud
        — and plain text-to-speech mangles all three. This playground pairs a{" "}
        <strong>plain</strong> and an <strong>SSML</strong> version of four
        common IVR lines so you can hear the fix. Edit the SSML and re-synthesize.
        Every call runs through <code>simba-3.2</code> / <code>geffen_32</code>{" "}
        server-side; the key never reaches the browser.
      </p>

      <section className="step">
        <h2>1. Pick an IVR line</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              data-active={p.id === presetId}
              onClick={() => {
                setPresetId(p.id);
                setAudioUrl(null);
                setBillable(null);
                setStatus("");
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="teaches">
          Teaches <code>{preset.teaches}</code>
        </p>
        <p className="hint">{preset.hint}</p>
      </section>

      <section className="step">
        <h2>2. Plain vs SSML</h2>
        <div className="toggle" role="tablist" aria-label="Input mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "plain"}
            data-active={mode === "plain"}
            onClick={() => setMode("plain")}
          >
            Plain
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ssml"}
            data-active={mode === "ssml"}
            onClick={() => setMode("ssml")}
          >
            SSML
          </button>
        </div>

        {mode === "plain" ? (
          <>
            <label htmlFor="plain">Plain text (read as-is)</label>
            <textarea id="plain" rows={5} readOnly value={preset.plain} />
          </>
        ) : (
          <>
            <label htmlFor="ssml">SSML (editable)</label>
            <textarea
              id="ssml"
              rows={10}
              value={ssmlValue}
              onChange={(e) =>
                setSsmlEdits((prev) => ({ ...prev, [presetId]: e.target.value }))
              }
              spellCheck={false}
            />
            {ssmlEdits[presetId] !== undefined ? (
              <button
                type="button"
                className="link"
                onClick={resetSsml}
              >
                Reset to the example SSML
              </button>
            ) : null}
          </>
        )}

        <div id="turnstile-container" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={synthesize}
          disabled={busy || tsState === "waiting"}
        >
          {busy
            ? "Synthesizing…"
            : tsState === "waiting"
              ? "Verifying you're human…"
              : `Synthesize ${mode === "ssml" ? "SSML" : "plain"}`}
        </button>

        <p className="status" data-tone={tone}>
          {status}
        </p>
        {audioUrl ? <audio controls src={audioUrl} /> : null}
        {billable !== null ? (
          <p className="meta">
            Billable characters: <code>{billable}</code>
          </p>
        ) : null}
      </section>

      <p className="foot">
        SSML supported here: <code>&lt;sub&gt;</code>, <code>&lt;prosody&gt;</code>,{" "}
        and <code>&lt;break&gt;</code>. Wrap everything in{" "}
        <code>&lt;speak&gt;…&lt;/speak&gt;</code>.
      </p>
    </main>
  );
}
