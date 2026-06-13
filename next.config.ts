import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Baseline security headers, all routes. CSP is limited to
        // frame-ancestors: a full script-src policy would need Next's inline
        // bootstrap scripts allowed and isn't worth the breakage risk here.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
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
    //
    // Cost controls (Vercel bills per transformation = unique source×width×
    // quality×format). Headshots are immutable, so cache optimized output for
    // a year instead of the 4-hour default (stops re-billing on revisit), and
    // trim the width buckets so small avatars don't generate large variants.
    // NOTE: once headshots are baked to static assets at ETL time these stop
    // mattering for them — they remain sensible defaults for any other image.
    minimumCacheTTL: 31_536_000,
    imageSizes: [32, 48, 64, 128],
    deviceSizes: [640, 1080, 1920],
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
      // theSportsDB community images: a late fallback stage of the resolver.
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
      // Long-tail hosts from the BasketballGM community photo map (final
      // resolver stage, mostly 1950s–90s players). This list must cover every
      // hostname the ETL prints under "fallback hosts" — re-check after each
      // `npm run etl:headshots`.
      { protocol: "https", hostname: "thedraftreview.com" },
      { protocol: "https", hostname: "www.thedraftreview.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "*.bp.blogspot.com" },
      { protocol: "https", hostname: "*.findagrave.com" },
      { protocol: "https", hostname: "alchetron.com" },
      { protocol: "https", hostname: "totallyradicalsportz.files.wordpress.com" },
      { protocol: "https", hostname: "www.cavshistory.com" },
      { protocol: "https", hostname: "www.latimes.com" },
      { protocol: "https", hostname: "www.legendsofbasketball.com" },
      { protocol: "https", hostname: "www.nasljerseys.com" },
    ],
  },
};

export default nextConfig;
