import type { NextConfig } from "next";

const basePath = "/multilingual-voiceover";

const nextConfig: NextConfig = {
  // Mounted as a Vercel Service under this subpath on demos.speechify.ai.
  // Standalone (`npm run dev`) also serves under this prefix.
  basePath,
};

export default nextConfig;
