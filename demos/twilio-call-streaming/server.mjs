// Streams Speechify TTS into a Twilio phone call over Media Streams.
//
// Twilio Media Streams sends and receives audio over a WebSocket as base64
// 8 kHz mu-law, in 20 ms (160-byte) frames. Speechify emits exactly that when
// you ask for `output_format: "ulaw_8000"` on POST /v1/audio/stream, so there
// is no transcoding: read the mu-law stream, cut it into 160-byte frames, and
// send each as a Twilio `media` message. The Speechify side here is real; the
// Twilio side is exercised by stub-twilio.mjs (no account or phone number
// needed). For a real call, point a TwiML <Connect><Stream> at /stream (see
// README) and GET /twiml.

import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8790);
const SPEECH_STREAM_URL = "https://api.speechify.ai/v1/audio/stream";
const FRAME_BYTES = 160; // 20 ms of 8 kHz mu-law

const DEFAULT_TEXT =
  process.env.TEXT ||
  "Hi! You're hearing a Speechify voice streamed straight into this call over Twilio Media Streams.";
const VOICE = process.env.VOICE_ID || "geffen_32";
const MODEL = process.env.MODEL || "simba-3.2";

function twiml(host) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/stream" />
  </Connect>
</Response>`;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.url === "/twiml") {
    res.writeHead(200, { "content-type": "text/xml" });
    res.end(twiml(req.headers.host || "example.com"));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/stream" });

wss.on("connection", (ws) => {
  let streamSid = null;

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Ignore anything we don't recognize, so new Twilio event types are safe.
    switch (msg.event) {
      case "connected":
        return;
      case "start":
        streamSid = msg.start?.streamSid || msg.streamSid;
        console.log(`[server] stream started: ${streamSid}`);
        await playInto(ws, streamSid, DEFAULT_TEXT);
        return;
      case "media":
        // Inbound caller audio. A real app might run STT here; we don't need it.
        return;
      case "stop":
        console.log("[server] stream stopped");
        return;
      default:
        return;
    }
  });

  ws.on("close", () => {
    streamSid = null;
  });
});

async function playInto(ws, streamSid, text) {
  const upstream = await fetch(SPEECH_STREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHIFY_API_KEY}`,
      "content-type": "application/json",
      Accept: "audio/basic",
    },
    body: JSON.stringify({
      input: text,
      voice_id: VOICE,
      model: MODEL,
      output_format: "ulaw_8000",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[server] Speechify error ${upstream.status}: ${detail}`);
    ws.send(JSON.stringify({ event: "mark", streamSid, mark: { name: "error" } }));
    return;
  }

  // Frame the mu-law stream into 160-byte (20 ms) Twilio media messages as the
  // bytes arrive, so playback can begin before synthesis finishes.
  const reader = upstream.body.getReader();
  let leftover = Buffer.alloc(0);
  let frames = 0;
  const sendFrame = (buf) => {
    ws.send(
      JSON.stringify({
        event: "media",
        streamSid,
        media: { payload: buf.toString("base64") },
      }),
    );
    frames++;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      leftover = Buffer.concat([leftover, Buffer.from(value)]);
      while (leftover.length >= FRAME_BYTES) {
        sendFrame(leftover.subarray(0, FRAME_BYTES));
        leftover = leftover.subarray(FRAME_BYTES);
      }
    }
    if (done) {
      if (leftover.length) sendFrame(leftover); // final partial frame
      break;
    }
  }

  // Tell the far end playback is done. Twilio echoes marks back on the stream.
  ws.send(JSON.stringify({ event: "mark", streamSid, mark: { name: "playback-complete" } }));
  console.log(`[server] sent ${frames} mu-law frames`);
}

server.listen(PORT, () => {
  console.log(`[server] listening on :${PORT} (ws path /stream, TwiML at /twiml)`);
});
