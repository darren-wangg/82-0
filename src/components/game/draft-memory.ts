"use client";

/**
 * Tiny per-device "drafter profile" that accumulates across drafts and feeds a
 * one-line personalization hint into the AI team summary.
 *
 * Deliberately minimal: one small localStorage object holding running sums (so
 * a single draft never needs a full history), a capped list of recent win
 * totals for form, and an idempotency key so the same draft is only counted
 * once. The derived blurb is COARSE on purpose — a handful of discrete buckets —
 * so identical descriptors are shared by many devices and the server's
 * roster-keyed explanation cache stays effective.
 */

import { NINE_CATS, type NineCat, type Roster } from "@/lib/contracts";
import type { PlayerStatLine } from "@/lib/contracts";

const KEY = "ud:draft-profile";
const PROFILE_V = 1 as const;
/** How many win totals we keep to read "form" (trending up/down). */
const RECENT_CAP = 6;
/** Don't personalize until there's a little history to lean on. */
const MIN_FOR_BLURB = 2;

/** Short, human labels for the cats we'll name in a blurb (tov omitted). */
const CAT_WORD: Partial<Record<NineCat, string>> = {
  pts: "scoring",
  reb: "rebounding",
  ast: "assists",
  stl: "steals",
  blk: "blocks",
  fgPct: "efficiency",
  ftPct: "free throws",
  tpm: "threes",
};

interface DraftProfile {
  v: typeof PROFILE_V;
  /** Total drafts recorded. */
  drafts: number;
  /** Last recorded draft key — guards against double-counting one draft. */
  lastKey: string;
  /** Win totals, oldest→newest, capped at RECENT_CAP. */
  recentWins: number[];
  /** Σ of each draft's average roster era (as a year). */
  yearSum: number;
  /** Σ of each draft's OFF / DEF ratings. */
  offSum: number;
  defSum: number;
  /** Σ of each draft's per-cat team profile (z-scores). */
  catSums: Record<NineCat, number>;
}

export interface DraftFeatures {
  /** Stable per-draft id used for idempotent recording. */
  key: string;
  wins: number;
  off: number;
  def: number;
  /** Average roster era expressed as a year (e.g. 1994). */
  avgYear: number;
  catProfile: Record<NineCat, number>;
}

function emptyCatSums(): Record<NineCat, number> {
  return Object.fromEntries(NINE_CATS.map((c) => [c, 0])) as Record<
    NineCat,
    number
  >;
}

function isProfile(x: unknown): x is DraftProfile {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as DraftProfile).v === PROFILE_V &&
    typeof (x as DraftProfile).drafts === "number"
  );
}

export function readProfile(): DraftProfile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Derive a stable id for a draft from its roster (sorted player ids). Identical
 * rosters across separate drafts collapse to one entry — an acceptable edge
 * case given the spin draft almost never repeats a full 8-man team.
 */
export function draftKey(roster: Roster): string {
  return [...Object.values(roster.starters), ...roster.bench].sort().join(",");
}

/** Average roster era as a year (parses the decade label, e.g. "1990s" → 1990). */
export function avgEraYear(
  roster: Roster,
  players: Map<string, PlayerStatLine>
): number {
  const ids = [...Object.values(roster.starters), ...roster.bench];
  let sum = 0;
  let n = 0;
  for (const id of ids) {
    const decade = players.get(id)?.decade;
    const year = decade ? parseInt(decade, 10) : NaN;
    if (!Number.isNaN(year)) {
      sum += year;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * Fold one completed draft into the stored profile (idempotent per draft key).
 * Best-effort: storage failures are swallowed so a draft never breaks on them.
 */
export function recordDraft(f: DraftFeatures): void {
  try {
    const prev =
      readProfile() ?? {
        v: PROFILE_V,
        drafts: 0,
        lastKey: "",
        recentWins: [],
        yearSum: 0,
        offSum: 0,
        defSum: 0,
        catSums: emptyCatSums(),
      };
    if (prev.lastKey === f.key) return; // already counted this draft

    const recentWins = [...prev.recentWins, f.wins].slice(-RECENT_CAP);
    const catSums = { ...prev.catSums };
    for (const c of NINE_CATS) catSums[c] += f.catProfile[c] ?? 0;

    const next: DraftProfile = {
      v: PROFILE_V,
      drafts: prev.drafts + 1,
      lastKey: f.key,
      recentWins,
      yearSum: prev.yearSum + f.avgYear,
      offSum: prev.offSum + f.off,
      defSum: prev.defSum + f.def,
      catSums,
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — personalization is a nice-to-have, never required
  }
}

/**
 * Boil the profile down to ONE coarse sentence for the AI prompt, or null when
 * there isn't enough history yet. Buckets are intentionally chunky so many
 * users share the same descriptor (keeps the explanation cache warm).
 */
export function describeProfile(p: DraftProfile | null): string | null {
  if (!p || p.drafts < MIN_FOR_BLURB) return null;
  const n = p.drafts;
  const parts: string[] = [];

  // Era lean.
  const era = p.yearSum / n;
  if (era >= 2005) parts.push("favors modern-era players");
  else if (era < 1990) parts.push("favors old-school eras");
  else parts.push("mixes eras");

  // Offense vs defense lean (ratings share a scale, so the gap is meaningful).
  const offDef = p.offSum / n - p.defSum / n;
  if (offDef > 2) parts.push("builds offense-first");
  else if (offDef < -2) parts.push("builds defense-first");
  else parts.push("builds balanced");

  // Favored cats: top two consistently-positive categories (tov excluded).
  const favored = (Object.entries(p.catSums) as [NineCat, number][])
    .filter(([c, v]) => c !== "tov" && CAT_WORD[c] && v / n > 0.4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([c]) => CAT_WORD[c]!);
  if (favored.length === 1) parts.push(`leans on ${favored[0]}`);
  else if (favored.length === 2)
    parts.push(`leans on ${favored[0]} and ${favored[1]}`);

  // Form: recent win total vs the average of the earlier ones.
  let form = "";
  const w = p.recentWins;
  if (w.length >= 3) {
    const last = w[w.length - 1];
    const prior = w.slice(0, -1);
    const priorAvg = prior.reduce((s, x) => s + x, 0) / prior.length;
    if (last - priorAvg > 6) form = "results trending up";
    else if (priorAvg - last > 6) form = "results trending down";
    else form = "results holding steady";
  }

  const tendencies = parts.join(", ");
  return form ? `${tendencies}; ${form}` : tendencies;
}
