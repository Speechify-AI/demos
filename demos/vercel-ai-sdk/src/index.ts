import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generateSpeech } from "ai";
import { speechify } from "@speechify/vercel";

if (!process.env.SPEECHIFY_API_KEY) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

// One call, all defaults: model simba-3.2, voice geffen_32, mp3 output.
const result = await generateSpeech({
  model: speechify.speech(),
  text:
    "This audio was generated through the Vercel AI SDK. " +
    "Swapping to SpeechifyAI from any other speech provider is a one line change.",
});

const outDir = path.join(import.meta.dirname, "..", "output");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "hello.mp3");
fs.writeFileSync(outPath, result.audio.uint8Array);

// SpeechifyAI's differentiator: word-level speech marks ride along in
// providerMetadata on the same response — no second alignment pass.
const meta = result.providerMetadata.speechify as {
  billableCharactersCount: number;
  speechMarks: { chunks: Array<{ value?: string; start_time?: number }> };
};

console.log(`wrote ${outPath} (${result.audio.uint8Array.length} bytes, ${result.audio.mediaType})`);
console.log(`billable characters: ${meta.billableCharactersCount}`);
console.log("first five word timings:");
for (const chunk of meta.speechMarks.chunks.slice(0, 5)) {
  console.log(`  ${String(chunk.start_time).padStart(5)} ms  ${chunk.value}`);
}
