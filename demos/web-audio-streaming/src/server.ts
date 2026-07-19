import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8766;
const UPSTREAM = "https://api.speechify.ai/v1/audio/stream";

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
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveStatic(urlPath: string): string | null {
  if (urlPath === "/") return path.join(ROOT, "demo", "index.html");
  if (urlPath.startsWith("/demo/")) return path.join(ROOT, urlPath.slice(1));
  return null;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/v1/audio/stream") {
    try {
      const body = await readBody(req);
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": req.headers["content-type"] ?? "application/json",
          Accept: req.headers.accept ?? "audio/pcm",
        },
        body,
      });

      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "audio/L16",
        "cache-control": "no-store",
      });

      if (!upstream.body) {
        res.end();
        return;
      }

      for await (const chunk of upstream.body) {
        res.write(Buffer.from(chunk));
      }
      res.end();
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
  console.log("  /  Web Audio streaming player");
});
