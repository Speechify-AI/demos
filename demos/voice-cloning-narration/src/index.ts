import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

const BASE = "https://api.speechify.ai";
const samplePath = path.resolve(import.meta.dirname, "../fixtures/spacewalk.wav");

interface CreatedVoice {
  id: string;
  display_name: string;
  type: string;
}

interface SpeechResponse {
  audio_data: string;
  audio_format: string;
  billable_characters_count: number;
}

const form = new FormData();
form.append("name", "demo-cloned-voice");
form.append("gender", "male");
form.append("consent", JSON.stringify({
  fullName: "Jane Doe",
  email: "jane@example.com",
}));

const sampleBytes = fs.readFileSync(samplePath);
form.append("sample", new Blob([sampleBytes], { type: "audio/wav" }), "spacewalk.wav");

const createRes = await fetch(`${BASE}/v1/voices`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

if (!createRes.ok) {
  if (createRes.status === 402) {
    console.error(
      "Voice cloning isn't included in your current Speechify plan.\n" +
        "Upgrade at https://speechify.ai/pricing",
    );
    process.exit(1);
  }
  throw new Error(`POST /v1/voices → ${createRes.status} ${await createRes.text()}`);
}

const voice = (await createRes.json()) as CreatedVoice;
console.log(`Cloned voice created: ${voice.id} (${voice.display_name})`);

try {
  const speechRes = await fetch(`${BASE}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: "Hello from a voice cloned with the Speechify API.",
      voice_id: voice.id,
      audio_format: "mp3",
      model: "simba-english",
    }),
  });

  if (!speechRes.ok) {
    throw new Error(`POST /v1/audio/speech → ${speechRes.status} ${await speechRes.text()}`);
  }

  const speech = (await speechRes.json()) as SpeechResponse;
  const outDir = path.resolve("output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "narration.mp3"), Buffer.from(speech.audio_data, "base64"));
  console.log("Wrote output/narration.mp3");
} finally {
  const delRes = await fetch(`${BASE}/v1/voices/${encodeURIComponent(voice.id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!delRes.ok) {
    console.error(`DELETE /v1/voices/${voice.id} → ${delRes.status}: ${await delRes.text()}`);
  } else {
    console.log(`Deleted cloned voice ${voice.id}`);
  }
}
