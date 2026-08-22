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

const VOICE = process.env.VOICE_ID ?? "george";
const MODEL = process.env.MODEL_ID ?? "simba-english";

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
  if (!interaction.isChatInputCommand() || interaction.commandName !== "speak") return;
  const text = interaction.options.getString("text", true).trim();
  if (!text) {
    await interaction.reply("Give me some text to speak.");
    return;
  }

  await interaction.deferReply();

  try {
    const response = await speechify.audio.speech({
      input: text,
      voice_id: VOICE,
      audio_format: "mp3",
      model: MODEL as "simba-english" | "simba-multilingual" | "simba-3.0" | "simba-3.2",
    });
    const audio = Buffer.from(response.audio_data, "base64");
    await interaction.editReply({
      content: `🎙 ${text.slice(0, 120)}`,
      files: [{ attachment: audio as any, name: "speak.mp3" }],
    });
  } catch (err) {
    const message =
      err instanceof SpeechifyError || err instanceof Error ? err.message : String(err);
    await interaction.editReply(`I couldn't speak that: ${message}`);
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