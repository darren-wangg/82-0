/**
 * CLIENT access point for the player-data snapshot. The JSON is fetched from
 * /data (long-lived immutable cache; the version is in the filename) instead
 * of being compiled into the JS bundle — it is ~1.6 MB raw and was the
 * largest client chunk by far.
 *
 * `GameProvider` (and any other entry point) awaits `loadSnapshot()` before
 * rendering snapshot-dependent UI; afterwards the sync accessors mirror the
 * server module's API.
 */

import { Snapshot, PlayerStatLine, Decade, EraBaselines } from "./contracts";
import { baselinesOf, parseSnapshot, playerMapOf, poolOf } from "./snapshot-core";

const SNAPSHOT_URL = "/data/snapshot-v1.json";

let cached: Snapshot | null = null;
let pending: Promise<Snapshot> | null = null;

export function loadSnapshot(): Promise<Snapshot> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch(SNAPSHOT_URL, { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`);
      return res.json();
    })
    .then((raw) => (cached = parseSnapshot(raw)))
    .catch((err) => {
      pending = null; // allow retry
      throw err;
    });
  return pending;
}

export function getSnapshot(): Snapshot {
  if (!cached) {
    throw new Error("Snapshot not loaded yet — await loadSnapshot() first");
  }
  return cached;
}

export function getPlayerMap(snapshot = getSnapshot()): Map<string, PlayerStatLine> {
  return playerMapOf(snapshot);
}

export function getPool(
  franchiseId: string,
  decade: Decade,
  snapshot = getSnapshot()
): PlayerStatLine[] {
  return poolOf(snapshot, franchiseId, decade);
}

export function getBaselines(snapshot = getSnapshot()): EraBaselines {
  return baselinesOf(snapshot);
}
