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
    ],
  },
};

export default nextConfig;
