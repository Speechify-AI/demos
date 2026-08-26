import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type Interaction,
} from "discord.js";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { buildSpeechRequest, SpeechValidationError } from "./lib/speech.js";
import {
  speakTextFrom,
  previewLine,
  failureMessage,
  REPLY_NO_TEXT,
  UPLOAD_FILENAME,
} from "./lib/interaction.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — copy .env.example to .env and fill it in.`);
  }
  return value;
}

const token = requireEnv("DISCORD_TOKEN");
const clientId = requireEnv("DISCORD_CLIENT_ID");
const speechify = new SpeechifyClient({ token: requireEnv("SPEECHIFY_API_KEY") });

const speak = new SlashCommandBuilder()
  .setName("speak")
  .setDescription("Read a message aloud with the Speechify API")
  .addStringOption((o) => o.setName("text").setDescription("Text to speak").setRequired(true));

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: [speak.toJSON()],
  });
  console.log("Registered /speak command.");
}

async function onInteraction(interaction: Interaction) {
  const text = speakTextFrom(interaction as never);
  if (text === null) return;

  if (!text) {
    await (interaction as { reply: (msg: string) => Promise<unknown> }).reply(REPLY_NO_TEXT);
    return;
  }

  await (interaction as { deferReply: () => Promise<unknown> }).deferReply();

  try {
    const request = buildSpeechRequest({
      text,
      voiceId: process.env.VOICE_ID,
      model: process.env.MODEL_ID,
    });
    const response = await speechify.audio.speech(request);
    const audio = Buffer.from(response.audio_data, "base64");
    await (interaction as unknown as {
      editReply: (opts: {
        content?: string;
        files?: { attachment: Buffer; name: string }[];
      }) => Promise<unknown>;
    }).editReply({
      content: previewLine(text),
      files: [{ attachment: audio, name: UPLOAD_FILENAME }],
    });
  } catch (err) {
    const message =
      err instanceof SpeechifyError || err instanceof SpeechValidationError || err instanceof Error
        ? err.message
        : String(err);
    await (interaction as unknown as {
      editReply: (opts: { content: string }) => Promise<unknown>;
    }).editReply({ content: failureMessage(message) });
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on("interactionCreate", onInteraction);

async function main() {
  await registerCommands();
  await client.login(token);
  console.log("discord-bot-speechify running — use /speak <text> in any server its app is in.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
