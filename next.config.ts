import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Skip duplicate tsc pass during next build to save RAM on VPS (typecheck is validated via npm run typecheck)
    ignoreBuildErrors: true,
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
