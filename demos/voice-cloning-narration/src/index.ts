import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

const BASE = "https://api.speechify.ai";
// The verified-consent flow ships on this API version.
const headers = { Authorization: `Bearer ${token}`, "Speechify-Version": "2026-09-13" };

const root = path.resolve(import.meta.dirname, "..");
const fullName = process.env.CONSENT_FULL_NAME ?? "Jane Doe";
const samplePath = path.resolve(root, process.env.SAMPLE_PATH ?? "sample.wav");
const consentPath = path.resolve(root, process.env.CONSENT_RECORDING_PATH ?? "consent.wav");
// The phrase is issued per challenge, so it survives between runs: one run to
// get the phrase, a second to submit the recording of it.
const challengePath = path.join(root, ".consent-challenge.json");

interface Challenge {
  id: string;
  phrase: string;
  expires_at: string;
}

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

function savedChallenge(): Challenge | null {
  if (!fs.existsSync(challengePath)) return null;
  const challenge = JSON.parse(fs.readFileSync(challengePath, "utf8")) as Challenge;
  return new Date(challenge.expires_at).getTime() > Date.now() ? challenge : null;
}

let challenge = savedChallenge();
if (!challenge) {
  const challengeRes = await fetch(`${BASE}/v1/voices/consent-challenges`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName }),
  });
  if (!challengeRes.ok) {
    throw new Error(
      `POST /v1/voices/consent-challenges → ${challengeRes.status} ${await challengeRes.text()}`,
    );
  }
  challenge = (await challengeRes.json()) as Challenge;
  fs.writeFileSync(challengePath, JSON.stringify(challenge, null, 2));
}

const missing = [
  fs.existsSync(samplePath) ? null : `  sample:  ${samplePath}  (${fullName}, 10-30 sec of clean speech)`,
  fs.existsSync(consentPath) ? null : `  consent: ${consentPath}  (the same person reading the phrase above)`,
].filter(Boolean);
if (missing.length > 0) {
  console.log(
    `Consent required. Have ${fullName} read this phrase aloud, exactly as written:\n\n` +
      `  "${challenge.phrase}"\n\n` +
      `Save these recordings, then run again (before ${challenge.expires_at}):\n` +
      missing.join("\n"),
  );
  process.exit(1);
}

const form = new FormData();
form.append("name", "demo-cloned-voice");
form.append("gender", "male");
form.append("consent_challenge_id", challenge.id);
form.append("sample", new Blob([fs.readFileSync(samplePath)]), path.basename(samplePath));
form.append("consent_recording", new Blob([fs.readFileSync(consentPath)]), path.basename(consentPath));

const createRes = await fetch(`${BASE}/v1/voices`, {
  method: "POST",
  headers,
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
  if (createRes.status === 409 || createRes.status === 422) {
    // A refused create spends the challenge, so the next run needs a new phrase.
    fs.rmSync(challengePath, { force: true });
    console.error(
      `Consent was not verified: ${await createRes.text()}\n` +
        "Run again for a new phrase, and record the same speaker reading it.",
    );
    process.exit(1);
  }
  throw new Error(`POST /v1/voices → ${createRes.status} ${await createRes.text()}`);
}
fs.rmSync(challengePath, { force: true });

const voice = (await createRes.json()) as CreatedVoice;
console.log(`Cloned voice created: ${voice.id} (${voice.display_name})`);

try {
  const speechRes = await fetch(`${BASE}/v1/audio/speech`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: "Hello from a voice cloned with the Speechify API.",
      voice_id: voice.id,
      audio_format: "mp3",
      model: "simba-3.0",
    }),
  });

  if (!speechRes.ok) {
    throw new Error(`POST /v1/audio/speech → ${speechRes.status} ${await speechRes.text()}`);
  }

  const speech = (await speechRes.json()) as SpeechResponse;
  const outDir = path.join(root, "output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "narration.mp3"), Buffer.from(speech.audio_data, "base64"));
  console.log("Wrote output/narration.mp3");
} finally {
  const delRes = await fetch(`${BASE}/v1/voices/${encodeURIComponent(voice.id)}`, {
    method: "DELETE",
    headers,
  });
  if (!delRes.ok) {
    console.error(`DELETE /v1/voices/${voice.id} → ${delRes.status}: ${await delRes.text()}`);
  } else {
    console.log(`Deleted cloned voice ${voice.id}`);
  }
}
