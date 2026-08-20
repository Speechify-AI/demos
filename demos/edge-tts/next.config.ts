import type { NextConfig } from "next";

const basePath = "/edge-tts";

const nextConfig: NextConfig = {
  // The Speechify SDK is server-only. This demo's edge route deliberately does
  // NOT use the SDK — it calls the REST API with fetch so it can run on the
  // edge runtime — but this stays in for parity with the other demos.
  serverExternalPackages: ["@speechify/api"],
  // Mounted as a Vercel Service under this subpath on demos.speechify.ai.
  // Standalone (`npm run dev`) also serves under this prefix.
  basePath,
};

export default nextConfig;
