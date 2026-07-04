import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Static entry pages only. Share pages (/t, /m, /l codes) are unbounded and
 *  spread by link; the draft/sim flows under these entries are client-state
 *  driven and meaningless to index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", "/budget", "/l", "/leaderboard"].map((path) => ({
    url: `${base}${path}`,
  }));
}
