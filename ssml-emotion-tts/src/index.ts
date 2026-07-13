import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

const client = new SpeechifyClient({ token });

const ssml = `<speak>
  <speechify:style emotion="warm">Welcome to the production incident update.</speechify:style>
  <break time="500ms" />
  <prosody rate="slow" pitch="low">The queue is draining, but keep monitoring error rates for the next ten minutes.</prosody>
  <break time="300ms" />
  <speechify:style emotion="assertive">Do not restart the workers unless the backlog climbs again.</speechify:style>
  <break time="400ms" />
  This is <emphasis level="strong">critical</emphasis> for customer playback.
  <break time="300ms" />
  Status page says <sub alias="all systems operational">ASO</sub> once the final region clears.
</speak>`;

try {
  const response = await client.audio.speech({
    input: ssml,
    voice_id: "george",
    audio_format: "mp3",
    model: "simba-english",
  });

  const outDir = path.resolve("output");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "ssml-emotion.mp3");
  fs.writeFileSync(outPath, Buffer.from(response.audio_data, "base64"));

  console.log(`Wrote output/ssml-emotion.mp3 (${response.billable_characters_count} billable characters).`);
} catch (err) {
  if (err instanceof SpeechifyError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
