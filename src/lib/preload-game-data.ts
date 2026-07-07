import { preload } from "react-dom";

/**
 * Warm the draft's client-fetched data (~1.6 MB snapshot + headshot fallback
 * map, both cached immutably) from the initial HTML, so the game loads from
 * the browser cache instead of fetching after the GameProvider mounts. Called
 * by the home page and every game-mode layout — including deep links, which
 * otherwise wait a full JS download + hydration before the fetch starts.
 */
export function preloadGameData() {
  preload("/data/snapshot-v1.json", { as: "fetch" });
  preload("/data/headshot-fallbacks-v1.json", { as: "fetch" });
}
