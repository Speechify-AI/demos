import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

const MAX_CHARS = 4_000;

function assertKey(): string {
  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  return token;
}

function stripDeep(node: string, start: string, end: string): string {
  let out = node;
  let i = out.indexOf(start);
  while (i !== -1) {
    const j = out.indexOf(end, i + start.length);
    if (j === -1) break;
    out = out.slice(0, i) + out.slice(j + end.length);
    i = out.indexOf(start, i);
  }
  return out;
}

export function extractArticleText(html: string): string {
  const lower = html.toLowerCase();
  let top = lower.indexOf("<article");
  if (top === -1) top = lower.indexOf("<main");
  if (top === -1) top = 0;
  let body = top > 0 ? html.slice(top) : html;

  for (const [s, e] of [
    ["<script", "</script>"],
    ["<style", "</style>"],
    ["<nav", "</nav>"],
    ["<aside", "</aside>"],
    ["<footer", "</footer>"],
    ["<form", "</form>"],
    ["<svg", "</svg>"],
  ]) {
    body = stripDeep(body, s, e);
  }

  const text = body
    .replace(/<br\s*\/?>\s*/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|div|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export function chunkText(text: string, maxLen: number = MAX_CHARS): string[] {
  const chunks: string[] = [];
  let buf = "";
  const paragraphs = text.split("\n\n").map((p) => p.trim()).filter(Boolean);

  for (const para of paragraphs) {
    if (buf.length + para.length + 2 <= maxLen) {
      buf = buf ? `${buf}\n\n${para}` : para;
      continue;
    }
    if (buf) {
      chunks.push(buf);
      buf = "";
    }
    if (para.length > maxLen) {
      for (const sent of para.split(/(?<=[.!?])\s+/)) {
        if (buf.length + sent.length + 1 <= maxLen) {
          buf = buf ? `${buf} ${sent}` : sent;
        } else {
          if (buf) chunks.push(buf);
          buf = sent;
        }
      }
    } else {
      buf = para;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function synthesizeChunks(client: SpeechifyClient, chunks: string[], voiceId: string, model: string, outDir: string): Promise<number> {
  fs.mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const resp = await client.audio.speech({
      input: chunks[i],
      voice_id: voiceId,
      audio_format: "mp3",
      model: model as "simba-english" | "simba-multilingual" | "simba-3.0" | "simba-3.2",
    });
    const out = path.join(outDir, `part-${String(i).padStart(3, "0")}.mp3`);
    fs.writeFileSync(out, Buffer.from(resp.audio_data, "base64"));
    total += resp.billable_characters_count ?? chunks[i].length;
    console.log(`  wrote ${out} (${resp.billable_characters_count} billable chars)`);
  }
  return total;
}

async function main() {
  const url = process.argv[2];
  const voiceId = process.argv.includes("--voice") ? process.argv[process.argv.indexOf("--voice") + 1] : "george";
  const model = process.argv.includes("--model") ? process.argv[process.argv.indexOf("--model") + 1] : "simba-english";

  if (!url) {
    console.error("Usage: npm start -- <blog-post-url> [--voice <id>] [--model <id>]");
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(url)) {
    console.error(`Not a URL: ${url}`);
    process.exit(1);
  }

  const client = new SpeechifyClient({ token: assertKey() });

  console.log(`Fetching ${url} ...`);
  const res = await fetch(url, { headers: { "user-agent": "speechify-blog-to-podcast-demo" } });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const html = await res.text();
  const text = extractArticleText(html);
  console.log(`Extracted ${text.length.toLocaleString()} characters of article text.`);
  if (!text) {
    throw new Error("No readable article text found — the page may be JS-rendered; point this at the raw HTML or a static post.");
  }

  const chunks = chunkText(text);
  console.log(`Split into ${chunks.length} chunk(s) (cap ${MAX_CHARS.toLocaleString()} chars).`);

  const slug = new URL(url).hostname.replace(/^www\./, "") + "-" + Date.now();
  const outDir = path.join("output", slug);
  const total = await synthesizeChunks(client, chunks, voiceId, model, outDir);
  console.log(`\nSynthesized ${chunks.length} chunks (${total.toLocaleString()} billable chars) to ${outDir}/`);
  console.log(`Stitch into one episode: ./concat.sh ${outDir} podcast-episode.mp3`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    if (err instanceof SpeechifyError) {
      console.error(err.message);
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  });
}