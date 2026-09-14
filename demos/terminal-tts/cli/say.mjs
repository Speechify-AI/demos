#!/usr/bin/env node
// speechify say — a tiny, dependency-free text-to-speech CLI.
//
// Reads text and flags from argv, calls the Speechify REST speech endpoint with
// your SPEECHIFY_API_KEY, and writes the resulting MP3 to a file. No SDK, no
// npm install — just native `fetch` and `node:fs`.
//
// Usage:
//   export SPEECHIFY_API_KEY=sk_...
//   node say.mjs "hello world"
//   node say.mjs "hello world" --voice harper_32 --model simba-3.2 --out hi.mp3
//
// Pipe straight to a player instead of a file:
//   node say.mjs "hello world" --out - | ffplay -autoexit -nodisp -   # ffmpeg
//   node say.mjs "hello world" --out - | mpv -                        # mpv
//   node say.mjs "hello world" --out - | afplay /dev/stdin            # macOS*
//   (*afplay can't read a pipe; write a file first: node say.mjs "hi" && afplay say.mp3)

import { writeFileSync } from "node:fs";

const ENDPOINT = "https://api.speechify.ai/v1/audio/speech";
const DEFAULTS = { voice: "geffen_32", model: "simba-3.2", out: "say.mp3" };

function parse(argv) {
  const positionals = [];
  const flags = {};
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
        flags[body] = true;
      }
    } else {
      positionals.push(tok);
    }
  }
  return { positionals, flags };
}

function usage() {
  console.error(
    [
      'Usage: node say.mjs "text to speak" [--voice id] [--model id] [--out file|-]',
      "",
      "  --voice   voice id (default geffen_32)",
      "  --model   model id (default simba-3.2)",
      "  --out     output mp3 path, or - for stdout (default say.mp3)",
      "",
      "Requires SPEECHIFY_API_KEY in the environment.",
    ].join("\n"),
  );
}

async function main() {
  const { positionals, flags } = parse(process.argv.slice(2));

  if (flags.help || flags.h) {
    usage();
    process.exit(0);
  }

  const text = positionals.join(" ").trim();
  if (!text) {
    usage();
    process.exit(1);
  }

  const key = process.env.SPEECHIFY_API_KEY;
  if (!key) {
    console.error("error: SPEECHIFY_API_KEY is not set in the environment.");
    process.exit(1);
  }

  const voice = flags.voice || DEFAULTS.voice;
  const model = flags.model || DEFAULTS.model;
  const out = flags.out || DEFAULTS.out;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      voice_id: voice,
      model,
      audio_format: "mp3",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`error: Speechify returned ${res.status} ${res.statusText}`);
    if (detail) console.error(detail);
    process.exit(1);
  }

  // The JSON speech endpoint returns base64 audio_data; decode to raw MP3 bytes.
  const data = await res.json();
  const audio = data.audio_data;
  if (typeof audio !== "string") {
    console.error("error: no audio_data in response");
    process.exit(1);
  }
  const bytes = Buffer.from(audio, "base64");

  if (out === "-") {
    process.stdout.write(bytes);
  } else {
    writeFileSync(out, bytes);
    console.error(`wrote ${bytes.length} bytes to ${out} (voice=${voice}, model=${model})`);
  }
}

main().catch((err) => {
  console.error("error:", err?.message ?? err);
  process.exit(1);
});
