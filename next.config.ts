import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Menu photo/PDF uploads (Role Training) can exceed the 1MB default.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
