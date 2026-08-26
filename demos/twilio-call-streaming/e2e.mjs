// End-to-end check with Twilio stubbed: boot the server, run the stub Twilio
// client against it, and propagate the stub's exit code. The Speechify call is
// real, so this needs SPEECHIFY_API_KEY. No Twilio anything.

import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 8790);

if (!process.env.SPEECHIFY_API_KEY) {
  console.error("[e2e] SPEECHIFY_API_KEY is not set; skipping.");
  process.exit(0);
}

const server = spawn("node", ["server.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const ok = await waitForHealth();
if (!ok) {
  console.error("[e2e] server did not come up");
  server.kill("SIGKILL");
  process.exit(1);
}

const stub = spawn("node", ["stub-twilio.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

stub.on("exit", (code) => {
  server.kill("SIGKILL");
  process.exit(code ?? 1);
});
