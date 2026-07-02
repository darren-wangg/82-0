"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NineCat, PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { ONE_DECIMAL, isEstimated, SORT_OPTIONS } from "./format";
import { isLegendary } from "./legends";
import { PlayerHeadshot } from "./player-headshot";

/** The stats toggle outlives the pool (which remounts every spin): kept in
 *  sessionStorage so the choice sticks for the whole tab session. */
const STATS_TOGGLE_KEY = "ud:pool-stats-visible";

function loadStatsVisible(): boolean {
  try {
    return window.sessionStorage.getItem(STATS_TOGGLE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Search starts collapsed to an icon; once the user opens it, it stays open
 *  for the rest of the tab session (and across spins, which remount the pool). */
const SEARCH_EXPANDED_KEY = "ud:pool-search-expanded";

function loadSearchExpanded(): boolean {
  try {
    return window.sessionStorage.getItem(SEARCH_EXPANDED_KEY) === "on";
  } catch {
    return false;
  }
}

/**
 * Stats-visibility toggle, lifted so the control can live in the draft header
 * while the pool below consumes the value. Persisted in sessionStorage so the
 * choice sticks across spins for the whole tab session.
 */
export function useStatsToggle() {
  const [showStats, setShowStats] = useState(loadStatsVisible);
  const toggleStats = () =>
    setShowStats((s) => {
      try {
        window.sessionStorage.setItem(STATS_TOGGLE_KEY, s ? "off" : "on");
      } catch {
        // storage unavailable — the toggle still works for this session
      }
      return !s;
    });
  return { showStats, toggleStats };
}

/** Lowercase + strip diacritics so search ignores both. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** The six per-game columns shown for every pool player. */
const ROW_CATS: { cat: NineCat; label: string }[] = [
  { cat: "pts", label: "PPG" },
  { cat: "reb", label: "RPG" },
  { cat: "ast", label: "APG" },
  { cat: "stl", label: "STL" },
  { cat: "blk", label: "BLK" },
  { cat: "tov", label: "TO" },
];

/**
 * The post-spin player pool: appears automatically once the reels settle,
 * sorted by the chosen stat (PPG by default). One tap selects a player and
 * lights up their eligible roster slots — placement happens on the board.
 * Players with no open eligible slot are shown dimmed.
 *
 * When `priceMap` is provided (budget mode), each player shows their $price
 * and players whose price would exceed the remaining budget are flagged.
 */
export function PoolList({
  pool,
  selectedId,
  isDraftable,
  onSelect,
  priceMap,
  remainingBudget,
}: {
  pool: PlayerStatLine[];
  selectedId: string | null;
  isDraftable: (id: string) => boolean;
  onSelect: (id: string | null) => void;
  /** Optional: budget-mode price map. When provided, shows $price per player. */
  priceMap?: Map<string, number> | null;
  /** Optional: remaining cap in budget mode. Players whose price exceeds this
   *  get a red price badge; the caller also marks them non-draftable so the
   *  cap is a hard limit. */
  remainingBudget?: number;
}) {
  const t = useTranslations("pool");
  const format = useFormatter();
  const { showStats, toggleStats } = useStatsToggle();
  const [sortCat, setSortCat] = useState<NineCat>("pts");
  const [query, setQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(loadSearchExpanded);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus synchronously inside the click so iOS opens the keyboard (a focus()
  // deferred to an effect falls outside the user gesture and is ignored). The
  // input is always mounted (sr-only when collapsed) so it's focusable here.
  const expandSearch = () => {
    setSearchExpanded(true);
    searchRef.current?.focus();
    try {
      window.sessionStorage.setItem(SEARCH_EXPANDED_KEY, "on");
    } catch {
      // storage unavailable — still opens for this view
    }
  };

  // Collapse back to the icon and drop any active filter, so the hidden search
  // never silently narrows the pool.
  const collapseSearch = () => {
    setSearchExpanded(false);
    setQuery("");
    try {
      window.sessionStorage.setItem(SEARCH_EXPANDED_KEY, "off");
    } catch {
      // storage unavailable — still collapses for this view
    }
  };

  const sorted = useMemo(() => {
    // Diacritic-insensitive ("jokic" finds Jokić) prefix-anywhere match.
    const q = normalize(query.trim());
    const matches = q
      ? pool.filter((p) => normalize(p.name).includes(q))
      : pool;
    // Hiding stats also drops the PPG/RPG ranking — everyone in one flat list.
    if (!showStats) return matches;
    return [...matches].sort((a, b) => b.stats[sortCat] - a.stats[sortCat]);
  }, [pool, sortCat, query, showStats]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-1.5 pb-1.5">
        {!searchExpanded && (
          <button
            type="button"
            onClick={expandSearch}
            aria-label={t("searchPlaceholder")}
            aria-expanded={false}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors active:scale-[0.97]"
          >
            <Search className="size-4" />
          </button>
        )}
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          // text-base (16px) keeps iOS from auto-zooming the page on focus.
          // sr-only when collapsed: stays in the DOM (so expandSearch can focus
          // it inside the gesture) but visually hidden behind the icon. Expanded,
          // it flexes to fill the row so the right-hand controls always fit.
          className={cn(
            "h-8 rounded-lg border border-border bg-card px-2.5 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            searchExpanded ? "min-w-0 flex-1" : "sr-only"
          )}
        />
        {searchExpanded && (
          <button
            type="button"
            onClick={collapseSearch}
            aria-label={t("closeSearch")}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors active:scale-[0.97]"
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-pressed={!showStats}
          onClick={toggleStats}
          className={cn(
            "ml-auto h-8 shrink-0 rounded-lg px-2 text-xs font-semibold transition-colors",
            showStats ? "text-muted-foreground" : "text-primary"
          )}
        >
          {showStats ? t("hideStats") : t("showStats")}
        </button>
        {/* No ranking control when stats are hidden — it's one flat list. */}
        {showStats && (
          <select
            value={sortCat}
            onChange={(e) => setSortCat(e.target.value as NineCat)}
            className="h-8 shrink-0 rounded-lg border border-border bg-card px-2 font-mono text-xs font-bold text-foreground"
            aria-label={t("sortBy")}
          >
            {SORT_OPTIONS.map(({ cat, label }) => (
              <option key={cat} value={cat}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {sorted.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {t("noMatch", { query: query.trim() })}
        </p>
      )}
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-2">
        {sorted.map((p, i) => {
          const draftable = isDraftable(p.id);
          const selected = selectedId === p.id;
          const legendary = isLegendary(p);
          const delay = Math.min(i * 0.035, 0.45);
          const price = priceMap?.get(p.id);
          const overBudget =
            price !== undefined &&
            remainingBudget !== undefined &&
            price > remainingBudget;
          return (
            <motion.li
              key={p.id}
              // Legendary pulls get a delayed, springy "jackpot" reveal.
              initial={legendary ? { opacity: 0, scale: 0.9 } : { opacity: 0, x: -14 }}
              animate={legendary ? { opacity: 1, scale: 1 } : { opacity: 1, x: 0 }}
              transition={
                legendary
                  ? { delay: delay + 0.45, type: "spring", stiffness: 320, damping: 17 }
                  : { delay, duration: 0.25 }
              }
            >
              <button
                type="button"
                disabled={!draftable}
                onClick={() => {
                  const next = selected ? null : p.id;
                  if (next) {
                    haptic("select");
                  }
                  onSelect(next);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/15 shadow-lg shadow-primary/25"
                    : legendary
                      ? "border-amber-400/60 bg-amber-400/10 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30"
                      : "border-border/80 bg-card/70 shadow-md shadow-black/25",
                  draftable ? "active:scale-[0.99]" : "opacity-40 grayscale"
                )}
              >
                <PlayerHeadshot player={p} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-bold",
                        legendary && "text-amber-200"
                      )}
                    >
                      {p.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 px-1 font-mono text-[9px]"
                      title={[p.position, ...p.altPositions].join("/")}
                    >
                      {/* Cap at 3 so true multi-position guys don't crowd out the name. */}
                      {[p.position, ...p.altPositions].slice(0, 3).join("/")}
                      {p.altPositions.length > 2 && "+"}
                    </Badge>
                    {/* Budget mode: price badge, red when over remaining cap. */}
                    {price !== undefined && (
                      <span
                        className={cn(
                          "ml-auto shrink-0 rounded px-1 font-mono text-[10px] font-bold tabular-nums",
                          overBudget
                            ? "bg-red-500/20 text-red-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        ${price}
                      </span>
                    )}
                  </div>
                  {showStats && (
                  <div className="mt-1 grid grid-cols-6 gap-1">
                    {ROW_CATS.map(({ cat, label }) => (
                      <div key={cat} className="flex flex-col items-start">
                        <span
                          className={cn(
                            "font-mono text-[11px] leading-none font-bold tabular-nums",
                            cat === sortCat ? "text-primary" : "text-foreground/90"
                          )}
                        >
                          {format.number(p.stats[cat], ONE_DECIMAL)}
                          {isEstimated(p, cat) && (
                            <span className="text-muted-foreground">*</span>
                          )}
                        </span>
                        <span className="text-[8px] font-semibold tracking-wider text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
