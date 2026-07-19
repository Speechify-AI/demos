#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { demos } = JSON.parse(readFileSync(join(root, "demos.json"), "utf8"));

// The README is a static artifact, so it needs a canonical origin baked in.
// Prefer Vercel's VERCEL_PROJECT_PRODUCTION_URL (always set at build, resolves
// to the shortest production custom domain — or the .vercel.app fallback until a
// custom domain is attached), so we never assume a domain that isn't live yet.
// DEMOS_HOSTED_ORIGIN overrides everything; the literal is only a last resort
// for local runs with no Vercel env.
function resolveHostedOrigin() {
  if (process.env.DEMOS_HOSTED_ORIGIN) return process.env.DEMOS_HOSTED_ORIGIN;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://demos.speechify.ai";
}
const HOSTED_ORIGIN = resolveHostedOrigin().replace(/\/+$/, "");
const liveUrl = (d) => `${HOSTED_ORIGIN}/${d.slug}`;

// Demo folders live under demos/<slug>; the public URL is still /<slug>. Keep
// the repo path (folder/source links) separate from the slug (URL path).
const repoPath = (d) => `demos/${d.slug}`;

function renderReadmeTable() {
  const rows = demos.map((d) => {
    const folder = `[\`${repoPath(d)}/\`](./${repoPath(d)})`;
    const live = d.hosted ? `[Open](${liveUrl(d)})` : "";
    return `| ${folder} | ${d.stack} | ${live} | ${d.blurb} |`;
  });
  return [
    "| Folder | Stack | Live | What it does |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const START = "<!-- DEMOS:START -->";
const END = "<!-- DEMOS:END -->";

function writeReadme() {
  const path = join(root, "README.md");
  const readme = readFileSync(path, "utf8");
  const table = renderReadmeTable();
  const block = `${START}\n${table}\n${END}`;
  const re = new RegExp(`${START}[\\s\\S]*${END}`);
  if (!re.test(readme)) {
    throw new Error(`README.md is missing the ${START} / ${END} markers`);
  }
  writeFileSync(path, readme.replace(re, block));
}

// Inline the manifest directly into index.html rather than a separate
// demos.generated.js. A standalone JS file is cached at the edge (max-age 14400)
// independently of the HTML, so a deploy can serve stale demo data for hours.
// Inlining ties the data to the (revalidated) HTML: always fresh, one fewer request.
const DATA_START = "/* DEMOS_DATA:START */";
const DATA_END = "/* DEMOS_DATA:END */";

function writeSiteData() {
  const path = join(root, "site", "public", "index.html");
  const html = readFileSync(path, "utf8");
  const payload = demos.map((d) => ({
    slug: d.slug,
    repoPath: repoPath(d),
    title: d.title,
    stack: d.stack,
    hosted: Boolean(d.hosted),
    blurb: d.blurb,
  }));
  const block = `${DATA_START}\n      window.__DEMOS__ = ${JSON.stringify(payload)};\n      ${DATA_END}`;
  const re = new RegExp(`${DATA_START.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[\\s\\S]*${DATA_END.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`);
  if (!re.test(html)) {
    throw new Error(`index.html is missing the ${DATA_START} / ${DATA_END} markers`);
  }
  writeFileSync(path, html.replace(re, block));
}

writeReadme();
writeSiteData();
console.log(`generated README table + site data for ${demos.length} demos`);
