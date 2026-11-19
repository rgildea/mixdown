import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is intentionally off. Almost every page is per-request (ADR 0008).
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
