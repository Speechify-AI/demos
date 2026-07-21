# Voice agent capability showcase

One page, ten live demos of the [Voice Agents API](https://docs.speechify.ai) — each section is a separate agent with its own voice, and every demo reacts on screen while you talk to it.

## What you get

| Line | Demo | What it shows |
| --- | --- | --- |
| 01 | Scheduling | A week calendar that books, moves, and cancels while you talk (client tools) |
| 02 | Support | Policy-bound refunds — the house policy lights up red/green as the agent reasons to the allowed path |
| 03 | Page copilot | The agent drives the page itself: theme, accent, navigation, guided tours |
| 04 | Intake | Voice in, structured form data out, field by field |
| 05 | Outbound | Dials a real US number; hard 5-minute cap enforced three ways |
| 06 | Voice gallery | The voice catalog with playable previews, baked at build time |
| 07 | Languages | Mid-call handoff between English, Spanish, and Hindi agents via `transfer_to_agent` — each with its own voice |
| 08 | Memory | Remembers returning callers across calls (`memory.enabled` + `userIdentity`) |
| 09 | Knowledge | Answers only from a five-document knowledge base, created by the setup script |
| 10 | Dual control | The agent writes to its own CRM live but must guide your hands through the phone toggles it cannot touch |

The page is a static site served by a Cloudflare Worker. The worker also holds the API key server-side for the outbound, memory-bank, and sweeper endpoints — the key never reaches the browser. Web sections use public agents through the widget SDK, gated by an origin allowlist.

## Run it yourself

```bash
cp .env.example .env            # paste your API key
npm install

# 1) Create the agents, tools, flows, and knowledge base in YOUR workspace.
#    Idempotent — reuses agents by name on re-runs. Writes public/config.js.
export $(cat .env) && npm run create-agents

# 2) Paste the printed outbound + memory agent ids into wrangler.jsonc "vars".

# 3) Run it locally (the agents already allow http://localhost:8787).
npm run dev
```

To deploy, then allow the deployed origin on the public agents:

```bash
npx wrangler deploy
npx wrangler secret put SPEECHIFY_API_KEY
export $(cat .env) && npm run patch-origins -- https://<your-worker-origin>
```

## Where the code came from

Built directly on the Voice Agents API: agents and tools via the REST API ([docs.speechify.ai](https://docs.speechify.ai)), browser calls via the widget SDK (`/v1/widget/agents.mjs`), conversation flows for the outbound agent, and `transfer_to_agent` for the language handoff.

## Prerequisites

- Node 20+ and a Cloudflare account (free tier is fine) for `wrangler dev`/`deploy`.
- A Speechify AI workspace API key from [platform.speechify.ai](https://platform.speechify.ai/api-keys).
- Optional, for Line 05 (outbound): an outbound-capable US phone number on your workspace; without it the other nine lines still work.
- The 5-minute outbound cap uses a Cloudflare cron trigger plus a page countdown; the workspace key must belong to a workspace owner or admin so the force-end call is authorized.
