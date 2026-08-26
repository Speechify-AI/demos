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
import { frameBytes, mediaMessage, markMessage } from "./frames.mjs";
import { twiml } from "./twiml.mjs";
import {
  SPEECH_STREAM_URL,
  buildStreamRequest,
  StreamValidationError,
  STREAM_ACCEPT_HEADER,
} from "./speech.mjs";

const PORT = Number(process.env.PORT || 8790);
const FRAME_BYTES = 160; // 20 ms of 8 kHz mu-law

const DEFAULT_TEXT =
  process.env.TEXT ||
  "Hi! You're hearing a Speechify voice streamed straight into this call over Twilio Media Streams.";

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
  let request;
  try {
    request = buildStreamRequest({
      text,
      voiceId: process.env.VOICE_ID,
      model: process.env.MODEL,
    });
  } catch (err) {
    if (err instanceof StreamValidationError) {
      console.error(`[server] ${err.message}`);
      ws.send(markMessage(streamSid, "error"));
      return;
    }
    throw err;
  }

  const upstream = await fetch(SPEECH_STREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPEECHIFY_API_KEY}`,
      "content-type": "application/json",
      Accept: STREAM_ACCEPT_HEADER,
    },
    body: JSON.stringify(request),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[server] Speechify error ${upstream.status}: ${detail}`);
    ws.send(markMessage(streamSid, "error"));
    return;
  }

  // Frame the mu-law stream into 160-byte (20 ms) Twilio media messages as the
  // bytes arrive, so playback can begin before synthesis finishes.
  const reader = upstream.body.getReader();
  let leftover = Buffer.alloc(0);
  let frames = 0;
  const sendFrames = (buf) => {
    const { frames: ready, leftover: rest } = frameBytes(buf, FRAME_BYTES);
    leftover = rest;
    for (const frame of ready) {
      ws.send(mediaMessage(streamSid, frame));
      frames++;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      leftover = Buffer.concat([leftover, Buffer.from(value)]);
      sendFrames(leftover);
    }
    if (done) {
      if (leftover.length) {
        ws.send(mediaMessage(streamSid, leftover)); // final partial frame
        frames++;
      }
      break;
    }
  }

  // Tell the far end playback is done. Twilio echoes marks back on the stream.
  ws.send(markMessage(streamSid, "playback-complete"));
  console.log(`[server] sent ${frames} mu-law frames`);
}

server.listen(PORT, () => {
  console.log(`[server] listening on :${PORT} (ws path /stream, TwiML at /twiml)`);
});
