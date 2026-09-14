// Pure digest logic: turn parsed RSS items into a spoken digest and split it
// into chunks that fit the speech endpoint. No I/O, no API — fully testable.

import { MAX_INPUT_CHARS } from "./speech.js";

export interface FeedItem {
  title?: string;
  pubDate?: string;
  contentSnippet?: string;
}

export interface FeedOutput {
  title?: string;
  items?: FeedItem[];
}

export function isToday(dateStr?: string, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export interface DigestOptions {
  today: boolean;
  latest: number;
}

// Builds the spoken digest text: an intro line, then each item's title and a
// two-sentence snippet. Throws when nothing matches the filters.
export function buildDigest(feed: FeedOutput, feedTitle: string, opts: DigestOptions): string {
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

// Splits text into chunks no longer than maxLen (default: the speech
// endpoint's 2,000-character cap), breaking on sentence boundaries so each
// chunk is a standalone spoken piece.
export function chunkText(text: string, maxLen: number = MAX_INPUT_CHARS): string[] {
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
