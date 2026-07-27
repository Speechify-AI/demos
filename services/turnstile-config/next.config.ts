import type { NextConfig } from "next";

// No basePath: the root vercel.json rewrite maps the public
// /api/turnstile/config path to this service's internal /api/config route
// directly (path override), so this app's own routing stays untouched.
const nextConfig: NextConfig = {};

export default nextConfig;
