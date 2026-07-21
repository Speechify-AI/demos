#!/usr/bin/env node
// Adds the deployed origin to every public showcase agent's allowed_origins.
//   SVA_KEY=<key> node scripts/patch-origins.mjs https://simba-showcase.<sub>.workers.dev

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SVA_BASE || "https://api.speechify.ai";
const KEY = process.env.SPEECHIFY_API_KEY || process.env.SVA_KEY;
const origin = (process.argv[2] || "").replace(/\/$/, "");
if (!KEY || !/^https:\/\//.test(origin)) {
  console.error("usage: SPEECHIFY_API_KEY=... node scripts/patch-origins.mjs https://<deployed-origin>");
  process.exit(1);
}

const ids = JSON.parse(readFileSync(join(ROOT, ".agent-ids.json"), "utf8"));

for (const slot of ["scheduling", "support", "copilot", "intake", "languages", "memory", "knowledge", "dualcontrol"]) {
  const id = ids[slot];
  const getRes = await fetch(`${BASE}/v1/agents/${id}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const agent = (await getRes.json()).agent ?? (await (await fetch(`${BASE}/v1/agents/${id}`, { headers: { Authorization: `Bearer ${KEY}` } })).json());
  const current = agent.allowed_origins || [];
  if (current.includes(origin)) {
    console.log(`= ${slot} already allows ${origin}`);
    continue;
  }
  const next = [...current, origin];
  const res = await fetch(`${BASE}/v1/agents/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_origins: next }),
  });
  if (!res.ok) {
    console.error(`! ${slot} PATCH failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`+ ${slot} now allows ${origin}`);
}
