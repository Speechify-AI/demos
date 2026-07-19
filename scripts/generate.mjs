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

function renderReadmeTable() {
  const rows = demos.map((d) => {
    const folder = `[\`${d.slug}/\`](./${d.slug})`;
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

function writeSiteData() {
  const path = join(root, "site", "public", "demos.generated.js");
  const payload = demos.map((d) => ({
    slug: d.slug,
    title: d.title,
    stack: d.stack,
    hosted: Boolean(d.hosted),
    blurb: d.blurb,
  }));
  const body = `window.__DEMOS__ = ${JSON.stringify(payload, null, 2)};\n`;
  writeFileSync(path, body);
}

writeReadme();
writeSiteData();
console.log(`generated README table + site data for ${demos.length} demos`);
