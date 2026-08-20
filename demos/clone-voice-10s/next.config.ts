import type { NextConfig } from "next";

const basePath = "/clone-voice-10s";

const nextConfig: NextConfig = {
  // The Speechify SDK is server-only; keep it out of the client bundle.
  serverExternalPackages: ["@speechify/api"],
  // Mounted as a Vercel Service under this subpath on demos.speechify.ai.
  // Standalone (`npm run dev`) also serves under this prefix.
  basePath,
};

export default nextConfig;
