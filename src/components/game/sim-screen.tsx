"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Check,
  Copy,
  ImageDown,
  RotateCcw,
  Save as SaveIcon,
  Share2,
  Swords,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NINE_CATS,
  OVR_MAX,
  POSITIONS,
  SEASON_GAMES,
  type MatchupResponse,
  type PlayerStatLine,
  type Roster,
  type SaveTeamRequest,
  type SaveTeamResponse,
} from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { CatProfileInfo } from "@/components/social/cat-profile-info";
import { analyzeCost } from "./cost-analysis";
import { Confetti } from "./confetti";
import { toRoster } from "./draft-state";
import { saveLocalTeam } from "./local-teams";
import { CAT_FRIENDLY, CAT_LABELS } from "./format";
import { freshSeed, useGame } from "./game-provider";
import { PlayerHeadshot } from "./player-headshot";
import { usePhaseGuard } from "./use-phase-guard";

const COUNT_UP_SECONDS = 2.2;
/** catProfile values are z-score-ish; clamp the bars to ±3. */
const CAT_RANGE = 3;

function useCountUp(target: number, duration: number, delay = 0): number {
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

/** The final roster: 5 starters + 3 bench, images and names only. */
function TeamView({
  roster,
  players,
}: {
  roster: Roster;
  players: Map<string, PlayerStatLine>;
}) {
  const slots: { label: string; id: string }[] = [
    ...POSITIONS.map((pos) => ({ label: pos as string, id: roster.starters[pos]! })),
    ...(["G", "F", "C"] as const).map((label, i) => ({
      label: label as string,
      id: roster.bench[i],
    })),
  ];
  return (
    <div className="mt-5 flex items-end gap-1">
      {slots.map(({ label, id }, i) => {
        const player = players.get(id);
        const bench = i >= POSITIONS.length;
        return (
          <motion.div
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
          </motion.div>
        );
      })}
    </div>
  );
}

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
  const reducedMotion = useReducedMotion();

  const [teamName, setTeamName] = useState("");
  // Lobby entries carry the entrant's name so the standings show whose team
  // is whose; remembered per device so it's typed once.
  const [playerName, setPlayerName] = useState("");
  const [save, setSave] = useState<SaveState>({ phase: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Save-to-device dialog (separate from sharing; nothing leaves the browser).
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSaved, setLocalSaved] = useState(false);

  const sim = useMemo(() => {
    if (!state || state.status !== "locked") return null;
    const roster: Roster | null = toRoster(state);
    if (!roster) return null;
    const engine = getEngine();
    const rating = engine.teamRating(roster, players, getBaselines());
    const season = engine.projectSeason(rating);
    const cost = analyzeCost(roster, rating, season, players, getBaselines());
    return { roster, rating, season, cost };
  }, [state, players]);

  const wins = useCountUp(sim?.season.wins ?? 0, COUNT_UP_SECONDS);
  const losses = useCountUp(sim?.season.losses ?? 0, COUNT_UP_SECONDS);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ud:player-name");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the persisted name once on mount
      if (stored) setPlayerName(stored);
    } catch {
      // storage unavailable (private mode) — start blank
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Buzz when the 82-0 lands (Android; iOS has no vibration API — no-op).
  useEffect(() => {
    if (sim?.season.wins !== SEASON_GAMES) return;
    const t = window.setTimeout(() => {
      try {
        navigator.vibrate?.([120, 60, 120, 60, 240]);
      } catch {
        // best-effort haptics only
      }
    }, COUNT_UP_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [sim]);

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { rating, season, roster, cost } = sim;
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
      // Lobby draft: enter the team and jump to the standings.
      if (state.lobbyCode) {
        const displayName = playerName.trim().slice(0, 24) || undefined;
        if (displayName) {
          try {
            window.localStorage.setItem("ud:player-name", displayName);
          } catch {
            // best-effort persistence only
          }
        }
        try {
          const l = await fetch("/api/lobbies/enter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: state.lobbyCode,
              teamSlug: data.team.slug,
              displayName,
            }),
          });
          if (l.ok) {
            router.push(`/l/${state.lobbyCode}`);
            return;
          }
          const err = (await l.json().catch(() => null)) as { error?: string } | null;
          setToast(err?.error ?? "Saved! Couldn't enter the lobby right now.");
        } catch {
          setToast("Saved! Couldn't enter the lobby right now.");
        }
        setSave({ phase: "saved", url: data.url });
        return;
      }
      // Challenge draft: run the head-to-head and jump to the result page.
      if (state.challengeSlug) {
        try {
          const m = await fetch("/api/matchups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamSlugA: data.team.slug,
              teamSlugB: state.challengeSlug,
            }),
          });
          if (m.ok) {
            const matchup: MatchupResponse = await m.json();
            router.push(`/m/${matchup.id}`);
            return;
          }
        } catch {
          // fall through: team is saved even if the battle couldn't run
        }
        setToast("Saved! Couldn't run the battle right now — try again from the team page.");
      }
      setSave({ phase: "saved", url: data.url });
    } catch {
      setSave({ phase: "error" });
      setToast("Saving is unavailable right now — your season is safe on this device.");
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

  const saveToDevice = () => {
    const name = localName.trim();
    if (name.length === 0 || name.length > 40) {
      setToast("Give your team a name (1–40 characters) first.");
      return;
    }
    const ok = saveLocalTeam({
      name,
      roster,
      snapshotVersion: state.snapshotVersion,
      rating,
      season,
    });
    if (!ok) {
      setToast("Couldn't save on this device — storage is unavailable.");
      return;
    }
    setLocalSaved(true);
  };

  const runItBack = () => {
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
    router.push("/play");
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* perfect-season celebration, timed to the record landing */}
      {perfect && !reducedMotion && <Confetti delay={COUNT_UP_SECONDS} />}

      {/* save (device) + share icons, top right */}
      <div className="flex justify-end gap-2">
        <Dialog
          open={localOpen}
          onOpenChange={(open) => {
            setLocalOpen(open);
            if (!open) setLocalSaved(false);
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Save this team to this device"
                className="rounded-full"
              />
            }
          >
            <SaveIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="dark border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle>Save to this device</DialogTitle>
              <DialogDescription>
                Name your team — it&apos;s stored only in this browser, no link,
                nothing shared.
              </DialogDescription>
            </DialogHeader>
            {localSaved ? (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-emerald-400" /> Saved to this
                device.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  value={localName}
                  maxLength={40}
                  placeholder="Name your team"
                  aria-label="Team name"
                  className="h-11 rounded-xl"
                  onChange={(e) => setLocalName(e.target.value)}
                />
                <Button
                  className="h-12 w-full rounded-xl text-base font-bold"
                  disabled={localName.trim().length === 0}
                  onClick={saveToDevice}
                >
                  <SaveIcon className="size-4" /> Save
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Share this team"
                className="rounded-full"
              />
            }
          >
            <Share2 className="size-4" />
          </DialogTrigger>
          <DialogContent className="dark border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle>
                {state.lobbyCode
                  ? "Enter the lobby"
                  : state.challengeSlug
                    ? "Battle your rival"
                    : "Share your team"}
              </DialogTitle>
              <DialogDescription>
                {state.lobbyCode
                  ? `Add your name and a team name — your entry shows up in lobby ${state.lobbyCode} instantly.`
                  : state.challengeSlug
                    ? "Name your team — sharing runs the best-of-7 against your rival."
                    : "Name your team to get a share link."}
              </DialogDescription>
            </DialogHeader>
            {save.phase === "saved" ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Share link ready!</p>
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
                <a
                  href={`${save.url}/card`}
                  download
                  className="text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  <ImageDown className="mr-1 inline size-3.5" />
                  Download the retro team card
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {state.lobbyCode && (
                  <Input
                    value={playerName}
                    maxLength={24}
                    placeholder="Your name (shown in standings)"
                    aria-label="Your name"
                    className="h-11 rounded-xl"
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                )}
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
                  disabled={
                    save.phase === "saving" ||
                    teamName.trim().length === 0 ||
                    (state.lobbyCode !== null && playerName.trim().length === 0)
                  }
                  onClick={saveTeam}
                >
                  {save.phase === "saving"
                    ? "Sharing…"
                    : state.lobbyCode
                      ? "Enter Lobby"
                      : state.challengeSlug
                        ? "Battle"
                        : "Share"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* final record */}
      <div className="flex flex-col items-center text-center">
        {/* outer: entrance spring; inner: endless pulse for a perfect season */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
        >
        <motion.p
          animate={perfect ? { scale: [1, 1.06, 1] } : undefined}
          transition={
            perfect
              ? { delay: COUNT_UP_SECONDS, repeat: Infinity, duration: 1.8 }
              : undefined
          }
          className={cn(
            "animate-gradient-x bg-[length:200%_auto] bg-clip-text font-display text-8xl tracking-tight text-transparent tabular-nums",
            perfect
              ? "bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300"
              : "bg-gradient-to-r from-primary via-violet-400 to-primary"
          )}
          aria-label={`Final record ${season.wins} and ${season.losses}`}
        >
          {wins}-{losses}
        </motion.p>
        </motion.div>
      </div>

      {/* the team */}
      <TeamView roster={roster} players={players} />

      {/* gate callout */}
      {season.gatedCategory && (
        <motion.div
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
        <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          9-cat profile <CatProfileInfo />
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

      {/* what cost you (absent on a perfect season) */}
      {cost && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: COUNT_UP_SECONDS + 0.4 }}
        >
          <Card className="mt-3 gap-1.5 border-border/60 bg-card/80 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              What cost you
            </p>
            {cost.kind === "gated" ? (
              <p className="text-sm leading-relaxed">
                The{" "}
                <span className="font-semibold">{CAT_FRIENDLY[cost.cat]}</span>{" "}
                gate{" "}
                {cost.winsLost > 0 ? (
                  <>
                    cost you{" "}
                    <span className="font-semibold text-red-400">
                      {cost.winsLost} {cost.winsLost === 1 ? "win" : "wins"}
                    </span>
                  </>
                ) : (
                  <>caps you at {cost.winCap} wins</>
                )}
                . Biggest culprit:{" "}
                <span className="font-semibold">{cost.culprit.player.name}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ({cost.culprit.z.toFixed(1)} vs era)
                </span>
                .
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                Weakest link:{" "}
                <span className="font-semibold">{cost.player.name}</span> at{" "}
                {cost.slot}
                {cost.outOfPosition && (
                  <span className="text-amber-400"> — playing out of position</span>
                )}
                . Upgrade that spot to push past {season.wins} wins.
              </p>
            )}
          </Card>
        </motion.div>
      )}

      {/* thumb-zone footer */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {state.lobbyCode && save.phase !== "saved" && (
          <Button
            className="h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
            onClick={() => setShareOpen(true)}
          >
            <Users className="size-5" /> Enter the lobby
          </Button>
        )}
        {state.challengeSlug && !state.lobbyCode && save.phase !== "saved" && (
          <Button
            className="h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
            onClick={() => setShareOpen(true)}
          >
            <Swords className="size-5" /> Battle your rival
          </Button>
        )}
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
