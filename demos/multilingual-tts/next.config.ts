import type { NextConfig } from "next";

// Mounted as a Vercel Service under this subpath on demos.speechify.ai.
// Standalone (`npm run dev`) also serves under this prefix.
const basePath = "/multilingual-tts";

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
