import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";
import { buildDigest, chunkText } from "./lib/digest.js";
import { buildSpeechRequest, SpeechValidationError } from "./lib/speech.js";

const parser = new Parser();

function requireKey(): string {
  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  return token;
}

async function main() {
  const args = process.argv.slice(2);
  const feedUrl = args[0];
  const today = args.includes("--today");
  let latest = 5;
  const li = args.indexOf("--latest");
  if (li !== -1) latest = Number(args[li + 1]);

  if (!feedUrl || !/^https?:\/\//i.test(feedUrl)) {
    console.error("Usage: npm start -- <rss-feed-url> [--today] [--latest <n>]");
    process.exit(1);
  }

  const client = new SpeechifyClient({ token: requireKey() });

  console.log(`Fetching ${feedUrl} ...`);
  let feed;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (err) {
    throw new Error(
      `Couldn't parse the feed at ${feedUrl}: ${err instanceof Error ? err.message : err}`,
    );
  }

  const feedTitle = feed.title?.trim() || feedUrl;
  const digest = buildDigest(feed, feedTitle, { today, latest });
  console.log(`Digest ready (${digest.length.toLocaleString()} characters).`);

  const chunks = chunkText(digest);
  console.log(`Split into ${chunks.length} chunk(s) (speech endpoint cap 2,000 chars).`);

  const slug = new URL(feedUrl).hostname.replace(/^www\./, "") + "-" + Date.now();
  const outDir = path.join("output", slug);
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const request = buildSpeechRequest({
      text: chunks[i],
      voiceId: process.env.VOICE_ID,
      model: process.env.MODEL_ID,
    });
    const resp = await client.audio.speech(request);
    const out = path.join(outDir, `part-${String(i).padStart(3, "0")}.mp3`);
    fs.writeFileSync(out, Buffer.from(resp.audio_data, "base64"));
    total += resp.billable_characters_count ?? chunks[i].length;
    console.log(`  wrote ${out} (${resp.billable_characters_count} billable chars)`);
  }

  console.log(`\nSynthesized ${chunks.length} chunk(s) (${total.toLocaleString()} billable chars) to ${outDir}/`);
  console.log(`Stitch into one digest: ./concat.sh ${outDir} daily-digest.mp3`);
}

main().catch((err) => {
  if (err instanceof SpeechValidationError) {
    console.error(err.message);
    process.exit(2);
  }
  if (err instanceof SpeechifyError || err instanceof Error) console.error(err.message);
  else console.error(err);
  process.exit(1);
});
