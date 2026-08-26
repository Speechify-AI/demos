// A stub of Twilio Media Streams. It stands in for a real phone call so you
// can run and test the demo with no Twilio account, number, or public tunnel.
//
// It connects to the server's /stream WebSocket, sends the same `connected`
// and `start` messages Twilio would, then collects the `media` frames the
// server streams back, decodes the base64 mu-law, and writes it to out.ul.
// It exits non-zero if no audio arrived, so it doubles as the e2e check.
//
// Play the result with ffmpeg:  ffplay -f mulaw -ar 8000 out.ul

import fs from "node:fs";
import WebSocket from "ws";

const PORT = Number(process.env.PORT || 8790);
const URL = `ws://localhost:${PORT}/stream`;
const STREAM_SID = "MZstub00000000000000000000000000";

const ws = new WebSocket(URL);
const frames = [];
let done = false;

const timeout = setTimeout(() => {
  finish("timed out waiting for audio");
}, 30_000);

ws.on("open", () => {
  ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
  ws.send(
    JSON.stringify({
      event: "start",
      sequenceNumber: "1",
      streamSid: STREAM_SID,
      start: {
        streamSid: STREAM_SID,
        callSid: "CAstub0000000000000000000000000000",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
    }),
  );
});

ws.on("message", (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.event === "media" && msg.media?.payload) {
    frames.push(Buffer.from(msg.media.payload, "base64"));
  } else if (msg.event === "mark" && msg.mark?.name === "playback-complete") {
    finish(null);
  } else if (msg.event === "mark" && msg.mark?.name === "error") {
    finish("server reported a synthesis error");
  }
});

ws.on("error", (e) => finish(`socket error: ${e.message}`));

function finish(err) {
  if (done) return;
  done = true;
  clearTimeout(timeout);
  try {
    ws.close();
  } catch {}

  const audio = Buffer.concat(frames);
  if (err) {
    console.error(`[stub] FAIL: ${err} (frames so far: ${frames.length})`);
    process.exit(1);
  }
  if (frames.length === 0 || audio.length < 1000) {
    console.error(`[stub] FAIL: too little audio (${frames.length} frames, ${audio.length} bytes)`);
    process.exit(1);
  }
  fs.writeFileSync("out.ul", audio);
  const seconds = (audio.length / 8000).toFixed(2);
  console.log(
    `[stub] OK: received ${frames.length} mu-law frames, ${audio.length} bytes (~${seconds}s). Wrote out.ul`,
  );
  console.log("[stub] play it: ffplay -f mulaw -ar 8000 out.ul");
  process.exit(0);
}
