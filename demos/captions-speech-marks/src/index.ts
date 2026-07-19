import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

interface SpeechMarkChunk {
  start_time?: number;
  end_time?: number;
  value?: string;
}

interface SpeechResponse {
  audio_data: string;
  audio_format: string;
  billable_characters_count: number;
  speech_marks: { chunks: SpeechMarkChunk[] };
}

function vttTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const millis = Math.floor(ms % 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(millis, 3)}`;
}

const text =
  "Speechify returns word-level timestamps alongside every synthesis call. " +
  "Each speech mark tells you when a word starts and ends in the audio, measured to the millisecond. " +
  "You can convert these directly into WebVTT cues without any forced-alignment pass.";

const res = await fetch("https://api.speechify.ai/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: text,
    voice_id: "george",
    audio_format: "mp3",
    model: "simba-english",
  }),
});

if (!res.ok) {
  throw new Error(`POST /v1/audio/speech → ${res.status} ${res.statusText}: ${await res.text()}`);
}

const data = (await res.json()) as SpeechResponse;
const outDir = path.resolve("output");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "sample.mp3"), Buffer.from(data.audio_data, "base64"));

let vtt = "WEBVTT\n\n";
for (const w of data.speech_marks.chunks) {
  vtt += `${vttTime(w.start_time ?? 0)} --> ${vttTime(w.end_time ?? 0)}\n${w.value ?? ""}\n\n`;
}
fs.writeFileSync(path.join(outDir, "sample.vtt"), vtt);

fs.writeFileSync(
  path.join(outDir, "sample.json"),
  JSON.stringify({ words: data.speech_marks.chunks, text }, null, 2),
);

console.log(`Wrote output/sample.mp3, output/sample.vtt, output/sample.json (${data.speech_marks.chunks.length} words).`);
