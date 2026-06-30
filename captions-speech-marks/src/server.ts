import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8765;
const UPSTREAM = "https://api.speechify.ai/v1/audio/speech";

const KEY = process.env.SPEECHIFY_API_KEY;
if (!KEY) {
  console.error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
  process.exit(1);
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveStatic(urlPath: string): string | null {
  if (urlPath === "/" || urlPath === "/synth") return path.join(ROOT, "demo", "synth.html");
  if (urlPath === "/karaoke") return path.join(ROOT, "demo", "karaoke.html");
  if (urlPath.startsWith("/output/") || urlPath.startsWith("/demo/")) {
    return path.join(ROOT, urlPath.slice(1));
  }
  return null;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/v1/audio/speech") {
    try {
      const body = await readBody(req);
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": req.headers["content-type"] ?? "application/json",
        },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      });
      res.end(text);
    } catch (err) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: (err as Error).message } }));
    }
    return;
  }

  const file = resolveStatic(url.pathname);
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`Demo server on http://localhost:${PORT}`);
  console.log(`  /synth    → synthesize + watch the network call`);
  console.log(`  /karaoke  → word-by-word highlight during playback`);
});
