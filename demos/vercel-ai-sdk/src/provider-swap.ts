import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generateSpeech, type SpeechModel } from "ai";
import { speechify } from "@speechify/vercel";

if (!process.env.SPEECHIFY_API_KEY) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

// The point of the AI SDK's unified speech interface: everything below
// this line is provider-agnostic. Switching TTS vendors is only ever
// this one assignment — e.g. openai.speech('tts-1') or
// elevenlabs.speech('eleven_multilingual_v2') — the synthesize()
// function never changes.
const model: SpeechModel = speechify.speech("simba-3.2");

async function synthesize(text: string, file: string) {
  const { audio } = await generateSpeech({
    model,
    text,
    voice: "wyatt_32",
    speed: 1.1,
    outputFormat: "mp3_24000_128",
  });
  const outPath = path.join(import.meta.dirname, "..", "output", file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, audio.uint8Array);
  console.log(`wrote ${outPath} (${audio.uint8Array.length} bytes)`);
}

await synthesize(
  "Same code, different provider. Only the model line changed.",
  "swap.mp3",
);
