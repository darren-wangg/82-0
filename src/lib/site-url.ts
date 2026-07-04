/**
 * Absolute origin for anything rendered outside a request cycle —
 * metadataBase (og/twitter image URLs), sitemap.xml, robots.txt. Vercel
 * injects the production host at build time; local dev and CI fall back to
 * localhost.
 */
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}
