import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

const MAX_CHARS = 4_000;
const parser = new Parser();

function requireKey(): string {
  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  return token;
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function buildDigest(feed: Parser.Output<any>, feedTitle: string, opts: { today: boolean; latest: number }): string {
  let items = feed.items ?? [];
  if (opts.today) items = items.filter((i) => isToday(i.pubDate));
  if (opts.latest > 0) items = items.slice(0, opts.latest);
  if (items.length === 0) {
    throw new Error(
      opts.today
        ? `No items published today in ${feedTitle}.`
        : `No items found in ${feedTitle}.`,
    );
  }

  const parts = [`Your daily digest for ${feedTitle}.`];
  for (const item of items) {
    const title = (item.title ?? "").trim();
    if (title) parts.push(title.replace(/\.$/, "."));
    const snippet = (item.contentSnippet ?? "").trim().replace(/\s+/g, " ");
    if (snippet) parts.push(snippet.split(/(?<=[.!?])\s+/).slice(0, 2).join(" "));
  }
  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function chunkText(text: string, maxLen: number = MAX_CHARS): string[] {
  const chunks: string[] = [];
  let buf = "";
  const paragraphs = text.split(/(?<=[.!?])\s+/);
  for (const para of paragraphs) {
    if (buf.length + para.length + 1 <= maxLen) {
      buf = buf ? `${buf} ${para}` : para;
    } else {
      if (buf) chunks.push(buf);
      buf = para;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
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
  console.log(`Split into ${chunks.length} chunk(s) (cap ${MAX_CHARS.toLocaleString()} chars).`);

  const slug = new URL(feedUrl).hostname.replace(/^www\./, "") + "-" + Date.now();
  const outDir = path.join("output", slug);
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const resp = await client.audio.speech({
      input: chunks[i],
      voice_id: process.env.VOICE_ID ?? "george",
      audio_format: "mp3",
      model: (process.env.MODEL_ID ?? "simba-english") as
        | "simba-english"
        | "simba-multilingual"
        | "simba-3.0"
        | "simba-3.2",
    });
    const out = path.join(outDir, `part-${String(i).padStart(3, "0")}.mp3`);
    fs.writeFileSync(out, Buffer.from(resp.audio_data, "base64"));
    total += resp.billable_characters_count ?? chunks[i].length;
    console.log(`  wrote ${out} (${resp.billable_characters_count} billable chars)`);
  }

  console.log(`\nSynthesized ${chunks.length} chunk(s) (${total.toLocaleString()} billable chars) to ${outDir}/`);
  console.log(`Stitch into one digest: ./concat.sh ${outDir} daily-digest.mp3`);
}

main().catch((err) => {
  if (err instanceof SpeechifyError || err instanceof Error) console.error(err.message);
  else console.error(err);
  process.exit(1);
});