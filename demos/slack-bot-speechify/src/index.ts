import "dotenv/config";
import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

const VOICE = process.env.VOICE_ID ?? "george";
const MODEL = process.env.MODEL_ID ?? "simba-english";

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

  if (msg.type !== "message") return;
  if (msg.subtype || msg.bot_id) return;
  const text = (msg.text ?? "").trim();
  if (!text || !msg.channel) return;

  console.log(`Reading ${text.length} characters aloud in #${msg.channel} ...`);

  try {
    const response = await speechify.audio.speech({
      input: text,
      voice_id: VOICE,
      audio_format: "mp3",
      model: MODEL as "simba-english" | "simba-multilingual" | "simba-3.0" | "simba-3.2",
    });

    const audio = Buffer.from(response.audio_data, "base64");

    await web.files.uploadV2({
      channel_id: msg.channel,
      file: audio,
      filename: "read-aloud.mp3",
      title: `Read aloud: ${text.slice(0, 80)}`,
    });

    console.log(
      `Posted read-aloud.mp3 (${audio.length.toLocaleString()} bytes, ` +
        `${response.billable_characters_count} billable characters).`,
    );
  } catch (err) {
    const message =
      err instanceof SpeechifyError || err instanceof Error ? err.message : String(err);
    console.error(`Failed to read "${text.slice(0, 120)}": ${message}`);
    if (msg.channel) {
      await web.chat.postMessage({ channel: msg.channel, text: `I couldn't read that aloud: ${message}` }).catch(() => {});
    }
  }
});

socket.start().then(() => {
  console.log("slack-bot-speechify running — join it to a channel and it reads every message aloud.");
});