import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT ?? 8787);

function requireKey(): string {
  const token = process.env.SPEECHIFY_API_KEY;
  if (!token) throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  return token;
}

const client = new SpeechifyClient({ token: requireKey() });
const VOICE = process.env.VOICE_ID ?? "george";
const MODEL = (process.env.MODEL_ID ?? "simba-english") as
  | "simba-english"
  | "simba-multilingual"
  | "simba-3.0"
  | "simba-3.2";

function send(req: http.IncomingMessage, res: http.ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

async function handleSpeak(req: http.IncomingMessage, res: http.ServerResponse) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let text: string;
  try {
    text = (JSON.parse(raw || "{}").text ?? "").toString().trim();
  } catch {
    send(req, res, 400, JSON.stringify({ error: "Bad JSON body" }), "application/json");
    return;
  }
  if (!text) {
    send(req, res, 400, JSON.stringify({ error: "body.text is required" }), "application/json");
    return;
  }

  try {
    const response = await client.audio.speech({
      input: text,
      voice_id: VOICE,
      audio_format: "mp3",
      model: MODEL,
    });
    const audio = Buffer.from(response.audio_data, "base64");
    res.writeHead(200, {
      "content-type": "audio/mpeg",
      "content-length": audio.length,
      "cache-control": "no-store",
    });
    res.end(audio);
  } catch (err) {
    const message = err instanceof SpeechifyError || err instanceof Error ? err.message : String(err);
    send(req, res, 502, JSON.stringify({ error: message }), "application/json");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "POST" && url.pathname === "/api/speak") {
    void handleSpeak(req, res);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"));
    send(req, res, 200, html.toString(), "text/html; charset=utf-8");
    return;
  }
  send(req, res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`docs-read-aloud running at http://localhost:${PORT}`);
  console.log("Click the Listen button on the docs page to hear the Speechify narration.");
});