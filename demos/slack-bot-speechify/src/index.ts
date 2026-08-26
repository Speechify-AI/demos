import "dotenv/config";
import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { buildSpeechRequest, SpeechValidationError } from "./lib/speech.js";
import {
  shouldReadAloud,
  uploadTitle,
  failureMessage,
  UPLOAD_FILENAME,
} from "./lib/message.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — copy .env.example to .env and fill it in.`);
  }
  return value;
}

const appToken = requireEnv("SLACK_APP_TOKEN");
const botToken = requireEnv("SLACK_BOT_TOKEN");
const speechify = new SpeechifyClient({ token: requireEnv("SPEECHIFY_API_KEY") });

const socket = new SocketModeClient({ appToken });
const web = new WebClient(botToken);

socket.on("message", async (event) => {
  const msg = event as {
    type?: string;
    subtype?: string;
    bot_id?: string;
    channel?: string;
    text?: string;
  };

  if (!shouldReadAloud(msg)) return;
  const text = (msg.text ?? "").trim();
  const channel = msg.channel!;

  console.log(`Reading ${text.length} characters aloud in #${channel} ...`);

  try {
    const request = buildSpeechRequest({
      text,
      voiceId: process.env.VOICE_ID,
      model: process.env.MODEL_ID,
    });

    const response = await speechify.audio.speech(request);

    const audio = Buffer.from(response.audio_data, "base64");

    await web.files.uploadV2({
      channel_id: channel,
      file: audio,
      filename: UPLOAD_FILENAME,
      title: uploadTitle(text),
    });

    console.log(
      `Posted ${UPLOAD_FILENAME} (${audio.length.toLocaleString()} bytes, ` +
        `${response.billable_characters_count} billable characters).`,
    );
  } catch (err) {
    const message =
      err instanceof SpeechifyError || err instanceof SpeechValidationError || err instanceof Error
        ? err.message
        : String(err);
    console.error(`Failed to read "${text.slice(0, 120)}": ${message}`);
    await web.chat
      .postMessage({ channel, text: failureMessage(text, message) })
      .catch(() => {});
  }
});

socket.start().then(() => {
  console.log("slack-bot-speechify running — join it to a channel and it reads every message aloud.");
});
