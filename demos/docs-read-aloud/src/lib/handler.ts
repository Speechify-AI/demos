// Pure request handling for the read-aloud server: body parsing and content
// type decisions. No I/O, no API — fully testable.

export interface SpeakBody {
  text: string;
}

// Parses a POST /api/speak JSON body into the text to speak. Returns:
// - { ok: true, text } for a valid body
// - { ok: false, status: 400, message } for anything the server must reject
export function parseSpeakBody(raw: string): { ok: true; text: string } | { ok: false; status: 400; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    return { ok: false, status: 400, message: "Bad JSON body" };
  }
  const obj = parsed as { text?: unknown };
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  if (!text) {
    return { ok: false, status: 400, message: "body.text is required" };
  }
  return { ok: true, text };
}

export const CONTENT_TYPE_MP3 = "audio/mpeg";

export function audioHeaders(audio: Buffer): Record<string, string> {
  return {
    "content-type": CONTENT_TYPE_MP3,
    "content-length": String(audio.length),
    "cache-control": "no-store",
  };
}
