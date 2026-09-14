// Proves the Speechify provider works on a Puter instance without a browser.
// Speaks one sentence through the same driver call puter.ai.txt2speech()
// makes (interface puter-tts, driver speechify-tts, method synthesize) and
// writes the MP3 next to this script.
//
//   PUTER_PASSWORD=<password> node smoke.mjs
//
// Env:
//   PUTER_API_ORIGIN  API origin of your instance (default http://api.puter.localhost:4100)
//   PUTER_USERNAME    account to sign in as (default admin — first boot prints its password)
//   PUTER_PASSWORD    required
import { writeFileSync } from 'node:fs';

const ORIGIN = process.env.PUTER_API_ORIGIN ?? 'http://api.puter.localhost:4100';
const USERNAME = process.env.PUTER_USERNAME ?? 'admin';
const PASSWORD = process.env.PUTER_PASSWORD;
if (!PASSWORD) {
  console.error('Set PUTER_PASSWORD (the first boot of a fresh instance prints the admin password).');
  process.exit(1);
}

// Node's resolver doesn't handle `*.localhost` subdomains and fetch
// forbids overriding the Host header, so use node:http directly: dial
// 127.0.0.1 while sending the original hostname as Host — Puter routes
// /drivers/call by its `api.` subdomain.
import http from 'node:http';
import https from 'node:https';
const call = (path, init = {}) => new Promise((resolve, reject) => {
  const url = new URL(path, ORIGIN);
  const local = url.hostname.endsWith('.localhost');
  const req = (url.protocol === 'https:' ? https : http).request({
    host: local ? '127.0.0.1' : url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: init.method ?? 'GET',
    // /login lives on the base domain (the GUI origin puter.js signs in
    // through); everything else here is api-subdomain routed.
    headers: { Host: init.base ? url.host.replace(/^api\./, '') : url.host, ...init.headers },
  }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const body = Buffer.concat(chunks);
      resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        url: url.href,
        headers: { get: (k) => res.headers[k.toLowerCase()] ?? null },
        text: async () => body.toString(),
        json: async () => JSON.parse(body.toString()),
        arrayBuffer: async () => body,
      });
    });
  });
  req.on('error', reject);
  if (init.body) req.write(init.body);
  req.end();
});

const json = async (res) => {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}: ${await res.text()}`);
  return res.json();
};

// 1. Account session — what the sign-in dialog produces.
const { token: sessionToken } = await json(await call(`/login`, {
  base: true,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
}));

// 2. App token — puter.js mints one per page origin; driver calls
//    reject bare session tokens by design.
const { token: appToken } = await json(await call(`/auth/get-user-app-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
  body: JSON.stringify({ origin: 'http://localhost:8000' }),
}));

// 3. The txt2speech driver call, exactly as puter.js sends it.
const res = await call(`/drivers/call`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
  body: JSON.stringify({
    interface: 'puter-tts',
    driver: 'speechify-tts',
    method: 'synthesize',
    args: {
      text: 'Hello from Speechify Simba 3.2, spoken by your own Puter instance.',
      provider: 'speechify',
      voice: 'geffen_32',
      model: 'simba-3.2',
      output_format: 'mp3',
    },
  }),
});
if (!res.ok || !res.headers.get('content-type')?.startsWith('audio/')) {
  console.error(`synthesize -> ${res.status} ${res.headers.get('content-type')}: ${await res.text()}`);
  process.exit(1);
}

const audio = Buffer.from(await res.arrayBuffer());
const isMp3 = audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
writeFileSync(new URL('./speechify.mp3', import.meta.url), audio);
console.log(`ok: ${audio.length} bytes of ${isMp3 ? 'MP3' : 'audio'} -> speechify.mp3`);
