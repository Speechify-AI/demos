import { describe, it, expect } from "vitest";
import { frameBytes, FRAME_BYTES, mediaMessage, markMessage } from "../frames.mjs";

// Twilio Media Streams framing contract: 8 kHz mu-law in 20 ms frames means
// exactly 160 bytes per frame. These tests pin the byte-slicing.

describe("FRAME_BYTES", () => {
  it("is 160 bytes (20 ms of 8 kHz mu-law)", () => {
    expect(FRAME_BYTES).toBe(160);
  });
});

describe("frameBytes", () => {
  it("splits a chunk into complete frames with no leftover", () => {
    const { frames, leftover } = frameBytes(Buffer.alloc(480));
    expect(frames.length).toBe(3);
    expect(frames.every((f) => f.length === 160)).toBe(true);
    expect(leftover.length).toBe(0);
  });

  it("carries partial bytes as leftover", () => {
    const { frames, leftover } = frameBytes(Buffer.alloc(500));
    expect(frames.length).toBe(3);
    expect(leftover.length).toBe(20);
  });

  it("accepts an empty buffer", () => {
    const { frames, leftover } = frameBytes(Buffer.alloc(0));
    expect(frames.length).toBe(0);
    expect(leftover.length).toBe(0);
  });

  it("round-trips bytes losslessly across chunk boundaries", () => {
    const original = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
    const cut = 333;
    const first = frameBytes(original.subarray(0, cut));
    const second = frameBytes(Buffer.concat([first.leftover, original.subarray(cut)]));
    const reassembled = Buffer.concat([...first.frames, ...second.frames, second.leftover]);
    expect(reassembled.equals(original)).toBe(true);
  });
});

describe("mediaMessage", () => {
  it("emits the documented Twilio media event shape", () => {
    const frame = Buffer.alloc(160, 7);
    const msg = JSON.parse(mediaMessage("SID123", frame));
    expect(msg).toEqual({
      event: "media",
      streamSid: "SID123",
      media: { payload: frame.toString("base64") },
    });
  });
});

describe("markMessage", () => {
  it("emits the documented Twilio mark event shape", () => {
    const msg = JSON.parse(markMessage("SID123", "playback-complete"));
    expect(msg).toEqual({
      event: "mark",
      streamSid: "SID123",
      mark: { name: "playback-complete" },
    });
  });
});
