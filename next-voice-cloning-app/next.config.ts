import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Speechify SDK is server-only; keep it out of the client bundle.
  serverExternalPackages: ["@speechify/api"],
};

export default nextConfig;
