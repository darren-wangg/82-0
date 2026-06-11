import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Snapshot + headshot fallback map are fetched at runtime (not
        // bundled); filenames are versioned, so cache them forever.
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
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
      // theSportsDB community images: the last fallback stage of the resolver.
      {
        protocol: "https",
        hostname: "r2.thesportsdb.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "www.thesportsdb.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
