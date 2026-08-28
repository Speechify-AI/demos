// Twilio Media Streams framing: split a byte stream into 20 ms frames.
//
// Twilio sends and receives audio over the Media Streams WebSocket as base64
// 8 kHz mu-law in 20 ms frames: 8000 samples/s * 1 byte * 0.02 s = 160 bytes.
// Speechify emits exactly that when asked for `output_format: "ulaw_8000"`,
// so the framing is a pure byte-slicing job — no resampling, no transcoding.

export const FRAME_BYTES = 160;

// Splits one incoming chunk into complete 160-byte frames plus any leftover
// bytes that do not yet form a full frame. Callers concatenate the leftover
// with the next chunk before calling again, and flush the final partial frame
// (if any) when the stream ends.
export function frameBytes(buf, frameBytes = FRAME_BYTES) {
  const frames = [];
  let offset = 0;
  while (buf.length - offset >= frameBytes) {
    frames.push(buf.subarray(offset, offset + frameBytes));
    offset += frameBytes;
  }
  return { frames, leftover: buf.subarray(offset) };
}

// The Twilio `media` message that carries one frame, exactly as documented in
// Twilio's Media Streams protocol.
export function mediaMessage(streamSid, frame) {
  return JSON.stringify({
    event: "media",
    streamSid,
    media: { payload: frame.toString("base64") },
  });
}

// The `mark` message Twilio echoes back; the server uses it to signal the end
// of playback to itself and any observer of the stream.
export function markMessage(streamSid, name) {
  return JSON.stringify({ event: "mark", streamSid, mark: { name } });
}
