"use client";

/**
 * The shared post-draft "reveal": the animated record count-up, the roster
 * headshots, OVR dial + OFF/DEF bars, the 9-cat profile, the "what cost you"
 * callout, and the streamed AI scouting report. Used by both the classic
 * SimScreen and the BudgetSimScreen so the two summaries stay identical.
 */

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { animate, m, useReducedMotion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NINE_CATS,
  OVR_MAX,
  POSITIONS,
  SEASON_GAMES,
  type PlayerStatLine,
  type Roster,
  type SeasonResult,
  type TeamRating,
} from "@/lib/contracts";
import { displayCatValue } from "@/lib/cat-display";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { CatProfileInfo } from "@/components/social/cat-profile-info";
import { ExplainStream } from "@/components/social/explain-stream";
import type { CostAnalysis } from "./cost-analysis";
import {
  avgEraYear,
  describeProfile,
  draftKey,
  readProfile,
  recordDraft,
} from "./draft-memory";
import { type BenchSlotDef } from "./draft-state";
import { CAT_LABELS, ONE_DECIMAL } from "./format";
import { PlayerHeadshot } from "./player-headshot";

export const COUNT_UP_SECONDS = 2.2;
/** catProfile values are z-score-ish; clamp the bars to ±3. */
const CAT_RANGE = 3;

export function useCountUp(target: number, duration: number, delay = 0): number {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- settle instantly instead of animating
      setValue(target);
      return;
    }
    const controls = animate(0, target, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, delay, reducedMotion]);
  return value;
}

/** Three staggered basketballs "dribbling" while the season simulates. */
function DribbleLoader() {
  return (
    <div aria-hidden className="flex items-end gap-2.5">
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.55,
            delay: i * 0.16,
            ease: "easeInOut",
          }}
          className="text-lg leading-none"
        >
          🏀
        </m.span>
      ))}
    </div>
  );
}

/** One-shot radial basketball burst fired when the record lands. */
const BURST_BALLS = [
  { x: -130, y: -70, rotate: -220 },
  { x: 130, y: -80, rotate: 220 },
  { x: -160, y: 6, rotate: -160 },
  { x: 160, y: -4, rotate: 160 },
  { x: -70, y: -125, rotate: -120 },
  { x: 76, y: -135, rotate: 140 },
];

function BallBurst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {BURST_BALLS.map((b, i) => (
        <m.span
          key={i}
          className="absolute text-2xl leading-none"
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{
            x: b.x,
            y: b.y,
            rotate: b.rotate,
            scale: [0.4, 1.15, 1],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          🏀
        </m.span>
      ))}
    </div>
  );
}

/** The animated record reveal, isolated so its 60 fps count-up re-renders
 *  only this subtree — not the whole sim screen. */
export function RecordReveal({ season }: { season: SeasonResult }) {
  const t = useTranslations("sim");
  const reducedMotion = useReducedMotion();
  const perfect = season.wins === SEASON_GAMES;
  // The record counts up like the season is actually being played: a single
  // 0→82 games counter with the losses sprinkled in proportionally, so
  // W + L always equals games played and both land on the final record.
  const gamesPlayed = useCountUp(SEASON_GAMES, COUNT_UP_SECONDS);
  const losses = Math.round((season.losses * gamesPlayed) / SEASON_GAMES);
  const wins = gamesPlayed - losses;

  // The payoff buzz, fired the moment the record lands. Centralized here so
  // both sim screens feel identical.
  const winningRecord = season.wins >= season.losses;

  // True once the count-up settles — gates the landing pop / ball burst.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const land = () => {
      setLanded(true);
      haptic(winningRecord ? "success" : "error");
    };
    if (reducedMotion) {
      land();
      return;
    }
    const timer = window.setTimeout(land, COUNT_UP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, winningRecord]);

  return (
    <div className="relative flex flex-col items-center text-center">
      {/* outer: entrance spring; middle: pop when the count lands;
          inner: endless pulse for a perfect season */}
      <m.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <m.div
          animate={landed && !reducedMotion ? { scale: [1, 1.18, 1] } : undefined}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <m.p
            animate={perfect ? { scale: [1, 1.06, 1] } : undefined}
            transition={
              perfect
                ? { delay: COUNT_UP_SECONDS, repeat: Infinity, duration: 1.8 }
                : undefined
            }
            className={cn(
              "animate-gradient-x bg-[length:200%_auto] bg-clip-text font-display text-8xl tracking-tight text-transparent tabular-nums",
              // NBA Jam fire sweeps: white-hot for the perfect season.
              perfect
                ? "bg-gradient-to-r from-yellow-200 via-amber-400 to-red-500"
                : "bg-gradient-to-r from-amber-300 via-primary to-red-500"
            )}
            aria-label={t("finalRecordAria", { wins: season.wins, losses: season.losses })}
          >
            {wins}-{losses}
          </m.p>
        </m.div>
      </m.div>
      {landed && !reducedMotion && <BallBurst />}
      {/* fixed-height slot so the loader leaving doesn't shift the layout */}
      <div className="flex h-7 items-center">
        {!landed && !reducedMotion ? (
          <DribbleLoader />
        ) : (
          landed &&
          perfect && (
            <m.p
              initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14 }}
              className="font-arcade text-xs text-amber-300"
            >
              {t("onFire")}
            </m.p>
          )
        )}
      </div>
    </div>
  );
}

function OvrDial({ ovr }: { ovr: number }) {
  const shown = useCountUp(ovr, 1.6, COUNT_UP_SECONDS * 0.5);
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, ovr / OVR_MAX));
  return (
    <div className="relative size-28">
      <svg viewBox="0 0 104 104" className="size-full -rotate-90">
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <m.circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{
            duration: 1.6,
            delay: COUNT_UP_SECONDS * 0.5,
            ease: "easeOut",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-black tabular-nums">
          {shown}
        </span>
        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">
          OVR / {OVR_MAX}
        </span>
      </div>
    </div>
  );
}

function RatingBar({
  label,
  value,
  delay,
}: {
  label: string;
  value: number;
  delay: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <m.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">
        {Math.round(value)}
      </span>
    </div>
  );
}

function CatBar({
  cat,
  value,
  delay,
}: {
  cat: (typeof NINE_CATS)[number];
  value: number;
  delay: number;
}) {
  const format = useFormatter();
  const clamped = Math.max(-CAT_RANGE, Math.min(CAT_RANGE, value));
  const positive = clamped >= 0;
  const widthPct = (Math.abs(clamped) / CAT_RANGE) * 50;
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 font-mono text-[10px] font-bold tracking-wide text-muted-foreground">
        {CAT_LABELS[cat]}
      </span>
      <div className="relative h-2.5 flex-1 rounded-full bg-muted">
        <div className="absolute top-0 left-1/2 h-full w-px bg-border" />
        <m.div
          className={cn(
            "absolute top-0 h-full",
            positive
              ? "left-1/2 rounded-r-full bg-emerald-500"
              : "right-1/2 rounded-l-full bg-red-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.7, delay, ease: "easeOut" }}
        />
      </div>
      <span
        className={cn(
          "w-10 text-right font-mono text-xs font-semibold tabular-nums",
          positive ? "text-emerald-400" : "text-red-400"
        )}
      >
        {format.number(value, { ...ONE_DECIMAL, signDisplay: "always" })}
      </span>
    </div>
  );
}

/** The final roster: 5 starters + the mode's bench, images and names only. */
function TeamView({
  roster,
  players,
  benchSlots,
}: {
  roster: Roster;
  players: Map<string, PlayerStatLine>;
  benchSlots: readonly BenchSlotDef[];
}) {
  const slots: { label: string; id: string }[] = [
    ...POSITIONS.map((pos) => ({ label: pos as string, id: roster.starters[pos]! })),
    ...benchSlots.map((b, i) => ({ label: b.label, id: roster.bench[i] })),
  ];
  return (
    <div className="mt-5 flex items-end gap-1">
      {slots.map(({ label, id }, i) => {
        const player = players.get(id);
        const bench = i >= POSITIONS.length;
        return (
          <m.div
            key={`${label}-${id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "block overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-background",
                bench ? "size-9" : "size-10",
                bench ? "ring-muted-foreground/30" : "ring-primary/50"
              )}
            >
              {player && <PlayerHeadshot player={player} className="size-full" />}
            </span>
            <span className="w-full truncate text-center text-[9px] leading-none text-muted-foreground">
              {player?.name.split(" ").slice(-1)[0] ?? "—"}
            </span>
            <span className="text-[8px] font-bold tracking-wider text-primary/70">
              {label}
            </span>
          </m.div>
        );
      })}
    </div>
  );
}

/**
 * The full reveal body shared by both sim screens: record → roster → gate
 * callout → OVR/OFF/DEF → 9-cat profile → "what cost you" → AI scouting.
 */
export function TeamRevealBody({
  roster,
  rating,
  season,
  cost,
  players,
  benchSlots,
  snapshotVersion,
}: {
  roster: Roster;
  rating: TeamRating;
  season: SeasonResult;
  cost: CostAnalysis | null;
  players: Map<string, PlayerStatLine>;
  benchSlots: readonly BenchSlotDef[];
  snapshotVersion: string;
}) {
  const t = useTranslations("sim");
  const catT = useTranslations("cats");
  const format = useFormatter();
  const reducedMotion = useReducedMotion();

  // The "what cost you" + scouting cards reveal only after the record lands.
  // They're kept out of the layout until then (mounted late / display:none
  // rather than opacity:0) so the page doesn't show a tall blank stretch
  // under the team summary during the count-up.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (reducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- settle instantly instead of animating
      setLanded(true);
      return;
    }
    const timer = window.setTimeout(() => setLanded(true), COUNT_UP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  // Drafter memory: read the blurb from PRIOR drafts first (so this draft never
  // personalizes its own summary), then fold this draft in for next time.
  // undefined = not yet resolved (client-only read); null = no blurb yet.
  const [profileBlurb, setProfileBlurb] = useState<string | null | undefined>(
    undefined
  );
  useEffect(() => {
    const blurb = describeProfile(readProfile());
    recordDraft({
      key: draftKey(roster),
      wins: season.wins,
      off: rating.offRating,
      def: rating.defRating,
      avgYear: avgEraYear(roster, players),
      catProfile: rating.catProfile,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only read of localStorage, resolved once per draft
    setProfileBlurb(blurb);
  }, [roster, season, rating, players]);

  return (
    <>
      {/* final record */}
      <RecordReveal season={season} />

      {/* the team */}
      <TeamView roster={roster} players={players} benchSlots={benchSlots} />

      {/* gate callout */}
      {season.gatedCategory && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }}
          transition={{
            delay: COUNT_UP_SECONDS + 0.2,
            x: { delay: COUNT_UP_SECONDS + 0.5, duration: 0.4 },
          }}
          className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            {t.rich("gateCapped", {
              cat: catT(`friendly.${season.gatedCategory}`),
              wins: season.winCap,
              b: (chunks) => <span className="font-semibold">{chunks}</span>,
            })}
          </p>
        </m.div>
      )}

      {/* ratings */}
      <Card className="mt-4 flex-row items-center gap-4 border-border/60 bg-card/80 p-4">
        <OvrDial ovr={rating.ovr} />
        <div className="flex flex-1 flex-col gap-3">
          <RatingBar
            label="OFF"
            value={rating.offRating}
            delay={COUNT_UP_SECONDS * 0.5}
          />
          <RatingBar
            label="DEF"
            value={rating.defRating}
            delay={COUNT_UP_SECONDS * 0.5 + 0.15}
          />
        </div>
      </Card>

      {/* 9-cat profile */}
      <Card className="mt-3 gap-2.5 border-border/60 bg-card/80 p-4">
        <p className="flex items-center gap-1 font-arcade text-[9px] text-muted-foreground uppercase">
          {t("nineCatProfile")} <CatProfileInfo />
        </p>
        {NINE_CATS.map((cat, i) => (
          <CatBar
            key={cat}
            cat={cat}
            value={displayCatValue(cat, rating.catProfile[cat])}
            delay={COUNT_UP_SECONDS * 0.4 + i * 0.06}
          />
        ))}
      </Card>

      {/* what cost you (absent on a perfect season) */}
      {cost && landed && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mt-3 gap-1.5 border-border/60 bg-card/80 p-4">
            <p className="font-arcade text-[9px] text-muted-foreground uppercase">
              {t("whatCostYou")}
            </p>
            {cost.kind === "gated" ? (
              <p className="text-sm leading-relaxed">
                {t.rich(
                  cost.winsLost > 0 ? "costGatedLost" : "costGatedCaps",
                  {
                    cat: catT(`friendly.${cost.cat}`),
                    winsLost: cost.winsLost,
                    winCap: cost.winCap,
                    culprit: cost.culprit.player.name,
                    z: format.number(cost.culprit.z, ONE_DECIMAL),
                    b: (chunks) => <span className="font-semibold">{chunks}</span>,
                    red: (chunks) => (
                      <span className="font-semibold text-red-400">{chunks}</span>
                    ),
                    mono: (chunks) => (
                      <span className="font-mono text-xs text-muted-foreground">
                        {chunks}
                      </span>
                    ),
                  }
                )}
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                {t.rich("costWeakLink", {
                  player: cost.player.name,
                  slot: cost.slot,
                  bench: cost.bench ? "yes" : "no",
                  oop: cost.outOfPosition ? "yes" : "no",
                  b: (chunks) => <span className="font-semibold">{chunks}</span>,
                  muted: (chunks) => (
                    <span className="text-muted-foreground">{chunks}</span>
                  ),
                  amber: (chunks) => (
                    <span className="text-amber-400">{chunks}</span>
                  ),
                })}
              </p>
            )}
          </Card>
        </m.div>
      )}

      {/* AI scouting report on the unsaved draft (server re-runs the engine).
          Works in both modes — the /api/explain draft path accepts the
          10-player roster via a route-local schema. Stays mounted while hidden
          so the AI request fires immediately; only the reveal waits for the
          record to land. */}
      <div
        className={cn(
          landed
            ? "animate-in delay-300 duration-500 fill-mode-both fade-in slide-in-from-bottom-2"
            : "hidden"
        )}
      >
        <Card className="mt-3 gap-1.5 border-border/60 bg-card/80 p-4">
          <p className="font-arcade text-[9px] text-muted-foreground uppercase">
            {t("scoutingReport")}
          </p>
          {/* Hold the AI request until the drafter blurb resolves, so we don't
              fire one explanation without it then a second one with it. */}
          {profileBlurb !== undefined ? (
            <ExplainStream
              request={{
                kind: "draft",
                roster,
                snapshotVersion,
                ...(profileBlurb ? { playerProfile: profileBlurb } : {}),
              }}
            />
          ) : (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
