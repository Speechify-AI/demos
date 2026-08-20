# Voice agent events inspector

A tiny debug view for a Speechify Voice Agent call. Watch a call unfold as a
timeline of realtime events — session start, user transcripts, agent replies,
tool calls and results, session end — either by **replaying a bundled sample
stream** or by **inspecting one of your own conversations by id**. The workspace
API key stays server-side.

Pairs with the Speechify post *Realtime agent events: debugging a live voice
agent call*.

## What you get

- A **timeline** that colour-codes events by source (session / user / agent /
  tool) and lets you expand any event's raw JSON payload.
- **Replay mode** — plays the sample event stream in
  [`app/sample-events.ts`](./app/sample-events.ts) against a scrubber, at
  0.5×–4× speed, so you can see how a call reads as a stream.
- **Inspect mode** — enter a `conv_…` id (or leave blank to list recent calls);
  the server proxies `GET /v1/agents/conversations/{id}` on the Voice Agents API
  and renders what comes back.
- **[`app/api/conversation/route.ts`](./app/api/conversation/route.ts)** — the
  one server route that holds the key and talks to the API.

## Run it yourself

```bash
cp .env.example .env      # paste your Speechify workspace API key
pnpm install
pnpm dev                  # http://localhost:8774/agent-events-inspector
```

Get a workspace key at [platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).
Replay mode needs no key; inspect mode needs a key with a Voice Agents workspace.

## On the event schema

The confirmed conversation record fields are `id`, `agent_id`, `status`,
`started_at`, `ended_at`, and `duration_ms` — the same ones the
[voice-agent-showcase](../voice-agent-showcase) reads. The per-event stream shape
in `app/sample-events.ts` is **illustrative**: it shows how you'd render a live
event feed, and the inspector renders whichever event/transcript array a live
conversation returns. Confirm the exact live event field names against the
[Voice Agents API docs](https://docs.speechify.ai) before wiring this to a
production audit tool.

## Abuse protection (hosted)

The hosted build gates `/api/conversation` with Cloudflare Turnstile via the
shared [`app/lib/turnstile.ts`](./app/lib/turnstile.ts) helper. It fail-opens
when `TURNSTILE_SECRET_KEY` is unset, so local dev and forks work with zero
config.

## Prerequisites

- Node 20+.
- For inspect mode: a Speechify workspace with the Voice Agents API and at least
  one conversation to look at.
