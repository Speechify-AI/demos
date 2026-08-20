"use client";

import { useRef, useState } from "react";

type Props = {
  /** The text to speak. */
  text: string;
  /** Server route that proxies Speechify so the API key stays server-side. */
  endpoint?: string;
  /** A Speechify voice id (see platform.speechify.ai). */
  voiceId?: string;
  /** Button label when idle. */
  label?: string;
  /**
   * Optional token provider for abuse-gated deployments (e.g. Cloudflare
   * Turnstile). Return null to send the request unauthenticated.
   */
  getToken?: () => Promise<string | null>;
};

type State = "idle" | "loading" | "playing" | "error";

/**
 * Adds a voice to any React app. Give it text, it plays that text as speech.
 * The whole component is client-side; the Speechify API key never touches the
 * browser because synthesis goes through your own `endpoint` route handler.
 */
export function SpeechifyVoice({
  text,
  endpoint = "/api/speak",
  voiceId = "geffen_32",
  label = "▶ Play",
  getToken,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<State>("idle");

  async function speak() {
    if (!text.trim() || state === "loading") return;
    setState("loading");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = getToken ? await getToken() : null;
      if (token) headers["x-turnstile-token"] = token;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voiceId }),
      });
      if (!res.ok) throw new Error(await res.text());

      const { audio } = (await res.json()) as { audio: string };
      const el = audioRef.current!;
      el.src = `data:audio/mpeg;base64,${audio}`;
      el.onended = () => setState("idle");
      await el.play();
      setState("playing");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button onClick={speak} disabled={state === "loading"} className="sv-btn">
        {state === "loading"
          ? "Synthesizing…"
          : state === "playing"
            ? "▮▮ Playing"
            : state === "error"
              ? "Retry"
              : label}
      </button>
      <audio ref={audioRef} hidden />
    </>
  );
}
