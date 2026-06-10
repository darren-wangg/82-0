import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Headshots are proxied through the image optimizer: the server fetches
    // from the (unofficial) NBA CDN and serves resized, cached, same-origin
    // images — clients never hit cdn.nba.com directly.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        pathname: "/headshots/**",
      },
      // Wikipedia-thumbnail fallbacks for players the NBA CDN doesn't cover
      // (see scripts/etl/headshots.ts).
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
};

export default nextConfig;
