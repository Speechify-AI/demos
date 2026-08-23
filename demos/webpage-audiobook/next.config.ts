import type { NextConfig } from "next";

// Mounted as a Vercel Service under this subpath on demos.speechify.ai.
const basePath = "/webpage-audiobook";

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
