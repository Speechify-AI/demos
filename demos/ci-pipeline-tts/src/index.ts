import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { buildSpeechRequest, DEFAULT_MODEL, SpeechValidationError, type SpeechAudioFormat, type SpeechModel } from "./lib/speech.ts";
import { buildEventMessage, type CiEvent } from "./lib/message.ts";

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

// Pull CI facts from the environment. GitHub Actions exposes these as
// GITHUB_* variables; a plain `npm start` falls back to a default message.
function ciEventFromEnv(): CiEvent {
  return {
    workflow: process.env.GITHUB_WORKFLOW,
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.GITHUB_REF_NAME,
    sha: process.env.GITHUB_SHA,
    status: process.env.CI_STATUS,
    eventName: process.env.GITHUB_EVENT_NAME,
    actor: process.env.GITHUB_ACTOR,
    commitMessage: process.env.CI_COMMIT_MESSAGE,
  };
}

function parseCli(): Partial<CiEvent> {
  const args = process.argv.slice(2);
  const ev: Partial<CiEvent> = {};
  for (let i = 0; i < args.length; i++) {
    const [flag, value] = [args[i], args[i + 1]];
    switch (flag) {
      case "--workflow":
        ev.workflow = value;
        i++;
        break;
      case "--repo":
        ev.repository = value;
        i++;
        break;
      case "--branch":
        ev.branch = value;
        i++;
        break;
      case "--sha":
        ev.sha = value;
        i++;
        break;
      case "--actor":
        ev.actor = value;
        i++;
        break;
      case "--status":
        ev.status = value;
        i++;
        break;
      case "--message":
        ev.commitMessage = value;
        i++;
        break;
      default:
        break;
    }
  }
  return ev;
}

async function main() {
  const model = (process.env.SPEECHIFY_MODEL ?? DEFAULT_MODEL) as SpeechModel;
  const voiceId = process.env.SPEECHIFY_VOICE_ID ?? "geffen_32";
  const audioFormat = (process.env.SPEECHIFY_AUDIO_FORMAT ?? "mp3") as SpeechAudioFormat;

  const event: CiEvent = { ...ciEventFromEnv(), ...parseCli() };
  const text = buildEventMessage(event);

  const request = buildSpeechRequest({ text, voiceId, model, audioFormat });

  const client = new SpeechifyClient({ token });
  const response = await client.audio.speech(request);

  const outDir = path.resolve("output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "ci-event.mp3");
  fs.writeFileSync(outPath, Buffer.from(response.audio_data, "base64"));

  console.log(`Spoke: "${text}"`);
  console.log(`Wrote ${outPath} (${response.billable_characters_count} billable characters).`);

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    await postToDiscord(webhook, outPath, text);
  }
}

// Optional: drop the MP3 into a Discord channel via a webhook. Discord webhooks
// accept a direct file upload with no extra token, which makes it the simplest
// way to hear a CI event in a channel.
async function postToDiscord(webhook: string, filePath: string, text: string): Promise<void> {
  const audio = fs.readFileSync(filePath);
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({ content: `\u{1F4E2} ${text}` }),
  );
  form.append(
    "file",
    new Blob([audio], { type: "audio/mpeg" }),
    "ci-event.mp3",
  );
  const res = await fetch(webhook, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Discord webhook returned ${res.status} ${res.statusText}`);
  }
}

main().catch((err) => {
  if (err instanceof SpeechValidationError) {
    console.error(err.message);
    process.exit(2);
  }
  if (err instanceof SpeechifyError) {
    console.error(`Speechify API error: ${err.message}`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
