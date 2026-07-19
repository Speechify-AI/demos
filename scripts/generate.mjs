#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { demos } = JSON.parse(readFileSync(join(root, "demos.json"), "utf8"));

const HOSTED_ORIGIN = "https://demos.speechify.ai";
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
