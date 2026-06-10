"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion } from "framer-motion";
import { Check, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NINE_CATS,
  OVR_MAX,
  SEASON_GAMES,
  type Roster,
  type SaveTeamRequest,
  type SaveTeamResponse,
} from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines } from "@/lib/snapshot";
import { cn } from "@/lib/utils";
import { toRoster } from "./draft-state";
import { CAT_FRIENDLY, CAT_LABELS } from "./format";
import { freshSeed, useGame } from "./game-provider";
import { usePhaseGuard } from "./use-phase-guard";

const COUNT_UP_SECONDS = 2.2;
/** catProfile values are z-score-ish; clamp the bars to ±3. */
const CAT_RANGE = 3;

function useCountUp(target: number, duration: number, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, delay]);
  return value;
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
        <motion.circle
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
        <motion.div
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
        <motion.div
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
        {value >= 0 ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; url: string }
  | { phase: "error" };

function SimSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="mx-auto h-24 w-56" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function SimScreen() {
  const { state, dispatch, players } = useGame();
  const allowed = usePhaseGuard(["locked"]);
  const router = useRouter();

  const [teamName, setTeamName] = useState("");
  const [save, setSave] = useState<SaveState>({ phase: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sim = useMemo(() => {
    if (!state || state.status !== "locked") return null;
    const roster: Roster | null = toRoster(state);
    if (!roster) return null;
    const engine = getEngine();
    const rating = engine.teamRating(roster, players, getBaselines());
    const season = engine.projectSeason(rating);
    return { roster, rating, season };
  }, [state, players]);

  const wins = useCountUp(sim?.season.wins ?? 0, COUNT_UP_SECONDS);
  const losses = useCountUp(sim?.season.losses ?? 0, COUNT_UP_SECONDS);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { rating, season, roster } = sim;
  const perfect = season.wins === SEASON_GAMES;

  const saveTeam = async () => {
    const name = teamName.trim();
    if (name.length === 0 || name.length > 40) {
      setToast("Give your team a name (1–40 characters) first.");
      return;
    }
    setSave({ phase: "saving" });
    const body: SaveTeamRequest = {
      teamName: name,
      roster,
      snapshotVersion: state.snapshotVersion,
    };
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      const data: SaveTeamResponse = await res.json();
      setSave({ phase: "saved", url: data.url });
    } catch {
      // Route may not exist yet (built by another wave) — degrade gracefully.
      setSave({ phase: "error" });
      setToast("Sharing coming soon — your season is saved on this device.");
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast(url);
    }
  };

  const runItBack = () => {
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
    router.push("/play");
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-6">
      {/* final record */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Season simulated
        </p>
        <p
          className={cn(
            "font-mono text-7xl font-black tracking-tighter tabular-nums",
            perfect && "text-emerald-400"
          )}
          aria-label={`Final record ${season.wins} and ${season.losses}`}
        >
          {wins}-{losses}
        </p>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: COUNT_UP_SECONDS }}
          className="text-sm text-muted-foreground"
        >
          {perfect
            ? `Perfection. ${SEASON_GAMES}-0. It actually happened.`
            : `${season.wins} wins. ${SEASON_GAMES - season.wins} short of immortality.`}
        </motion.p>
      </div>

      {/* gate callout */}
      {season.gatedCategory && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: COUNT_UP_SECONDS + 0.2 }}
          className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <span className="font-semibold">
              {CAT_FRIENDLY[season.gatedCategory]}
            </span>{" "}
            capped you at {season.winCap} wins.
          </p>
        </motion.div>
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
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          9-cat profile
        </p>
        {NINE_CATS.map((cat, i) => (
          <CatBar
            key={cat}
            cat={cat}
            value={rating.catProfile[cat]}
            delay={COUNT_UP_SECONDS * 0.4 + i * 0.06}
          />
        ))}
      </Card>

      {/* save & share */}
      <Card className="mt-3 gap-3 border-border/60 bg-card/80 p-4">
        {save.phase === "saved" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Team saved!</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2.5 py-2 font-mono text-xs">
                {save.url}
              </code>
              <Button
                variant="outline"
                className="h-10 shrink-0"
                onClick={() => copyLink(save.url)}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Input
              value={teamName}
              maxLength={40}
              placeholder="Name your team"
              aria-label="Team name"
              className="h-11 rounded-xl"
              onChange={(e) => setTeamName(e.target.value)}
            />
            <Button
              className="h-12 w-full rounded-xl text-base font-bold"
              disabled={save.phase === "saving" || teamName.trim().length === 0}
              onClick={saveTeam}
            >
              {save.phase === "saving" ? "Saving…" : "Save & Share"}
            </Button>
          </>
        )}
      </Card>

      {/* thumb-zone footer */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          className="h-14 w-full rounded-2xl text-lg font-bold"
          onClick={runItBack}
        >
          <RotateCcw className="size-5" /> Run it back
        </Button>
      </div>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
