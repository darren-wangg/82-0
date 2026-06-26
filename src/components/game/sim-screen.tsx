"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  LogOut,
  RotateCcw,
  Save as SaveIcon,
  Share2,
  Swords,
  Users,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  SEASON_GAMES,
  type MatchupResponse,
  type Roster,
  type SaveTeamRequest,
  type SaveTeamResponse,
} from "@/lib/contracts";
import { containsProfanity } from "@/lib/profanity";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { DownloadCardButton } from "@/components/social/download-card";
import { analyzeCost } from "./cost-analysis";
import { Confetti } from "./confetti";
import { CLASSIC_MODE, toRoster } from "./draft-state";
import { saveLocalTeam } from "./local-teams";
import { freshSeed, useGame } from "./game-provider";
import { usePhaseGuard } from "./use-phase-guard";
import { COUNT_UP_SECONDS, TeamRevealBody } from "./team-reveal";

/** Lobby entrants get one re-draft if they don't like their first team. */
const MAX_LOBBY_RETRIES = 1;
const lobbyRetryKey = (code: string) => `ud:lobby-retries:${code}`;

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; url: string }
  | { phase: "error" };

function SimSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4" aria-busy>
      {/* top-right action icons (download / save / share) */}
      <div className="flex justify-end gap-2">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      {/* record reveal */}
      <Skeleton className="mx-auto h-20 w-56" />
      {/* roster */}
      <Skeleton className="h-44 w-full rounded-xl" />
      {/* 9-cat profile */}
      <Skeleton className="h-56 w-full rounded-xl" />
      {/* primary action */}
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function SimScreen() {
  const t = useTranslations("sim");
  const { state, dispatch, ctx, players } = useGame();
  const allowed = usePhaseGuard(["locked"]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const mode = ctx.mode ?? CLASSIC_MODE;

  const [teamName, setTeamName] = useState("");
  // Lobby entries carry the entrant's name so the standings show whose team
  // is whose; remembered per device so it's typed once.
  const [playerName, setPlayerName] = useState("");
  const [save, setSave] = useState<SaveState>({ phase: "idle" });
  // Synchronous double-tap guard: the disabled prop lags a fast second tap
  // (React state), so two parallel saves are otherwise possible.
  const savingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Inline (in-dialog) errors. A toast renders behind the modal overlay, so
  // name rejections have to surface inside the dialog to be seen.
  const [shareError, setShareError] = useState<string | null>(null);
  // Save-to-device dialog (separate from sharing; nothing leaves the browser).
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSaved, setLocalSaved] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  // Lobby re-draft: one per device per lobby, tracked in localStorage so it
  // survives the NEW_GAME state reset and page reloads. null until read.
  const [lobbyRetriesUsed, setLobbyRetriesUsed] = useState<number | null>(null);

  const sim = useMemo(() => {
    if (!state || state.status !== "locked") return null;
    const roster: Roster | null = toRoster(state);
    if (!roster) return null;
    const engine = getEngine();
    const rating = engine.teamRating(roster, players, getBaselines());
    const season = engine.projectSeason(rating);
    const cost = analyzeCost(roster, rating, season, players, getBaselines(), {
      // 10-player rosters carry a deeper bench — let a weak reserve be named.
      considerBench: roster.bench.length > 3,
    });
    return { roster, rating, season, cost };
  }, [state, players]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ud:player-name");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the persisted name once on mount
      if (stored) setPlayerName(stored);
    } catch {
      // storage unavailable (private mode) — start blank
    }
  }, []);

  // Read how many lobby re-drafts this device has already used (per lobby).
  const lobbyCode = state?.lobbyCode ?? null;
  useEffect(() => {
    if (!lobbyCode) return;
    let used = 0;
    try {
      used = Number(window.localStorage.getItem(lobbyRetryKey(lobbyCode))) || 0;
    } catch {
      // storage unavailable — treat as no retries used
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate once per lobby
    setLobbyRetriesUsed(used);
  }, [lobbyCode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Buzz when the 82-0 lands (Android; iOS has no vibration API — no-op).
  useEffect(() => {
    if (sim?.season.wins !== SEASON_GAMES) return;
    const timer = window.setTimeout(() => {
      try {
        navigator.vibrate?.([120, 60, 120, 60, 240]);
      } catch {
        // best-effort haptics only
      }
    }, COUNT_UP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [sim]);

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { rating, season, roster, cost } = sim;
  const perfect = season.wins === SEASON_GAMES;

  const saveTeam = async () => {
    if (savingRef.current) return;
    const name = teamName.trim();
    if (name.length === 0 || name.length > 40) {
      setShareError(t("toastNameRequired"));
      return;
    }
    // Same blocklist the server enforces — catch it here so the error shows
    // inside the dialog instead of as a server 422 behind the overlay.
    if (containsProfanity(name)) {
      setShareError(t("nameRejected"));
      return;
    }
    setShareError(null);
    savingRef.current = true;
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
      // Deploy-time skew: the server is on newer player data than this draft.
      if (res.status === 409) {
        setSave({ phase: "error" });
        setToast(t("toastStaleData"));
        return;
      }
      // The save route's only 422 is a rejected (profane) team name. Surface it
      // inline in the dialog so the user can fix the name and retry.
      if (res.status === 422) {
        setSave({ phase: "idle" });
        setShareError(t("nameRejected"));
        return;
      }
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
            // The team is now locked into the lobby. Clear this device's draft
            // so the submitted team can't be reopened from /sim or resurrected
            // on the next /play — a stored "locked" draft would bounce the user
            // straight back into this summary (re-draft / submit / leave).
            // Don't dispatch NEW_GAME here: flipping state to "draft" trips the
            // phase guard, which would race our push to the lobby.
            try {
              window.localStorage.removeItem(mode.storageKey);
            } catch {
              // storage unavailable — nothing persisted to clear
            }
            router.push(`/l/${state.lobbyCode}`);
            return;
          }
          const err = (await l.json().catch(() => null)) as { error?: string } | null;
          setToast(err?.error ?? t("toastLobbyEnterFailed"));
        } catch {
          setToast(t("toastLobbyEnterFailed"));
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
        setToast(t("toastBattleFailed"));
      }
      setSave({ phase: "saved", url: data.url });
    } catch {
      setSave({ phase: "error" });
      setToast(t("toastSaveUnavailable"));
    } finally {
      savingRef.current = false;
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
      setDeviceError(t("toastNameRequired"));
      return;
    }
    // Apply the blocklist to device saves too — otherwise a profane name slips
    // straight into My Teams (the server check only guards the share path).
    if (containsProfanity(name)) {
      setDeviceError(t("nameRejected"));
      return;
    }
    setDeviceError(null);
    const ok = saveLocalTeam({
      name,
      roster,
      snapshotVersion: state.snapshotVersion,
      rating,
      season,
    });
    if (!ok) {
      setToast(t("toastDeviceSaveFailed"));
      return;
    }
    setLocalSaved(true);
  };

  const runItBack = () => {
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
    router.push(mode.playPath);
  };

  // One re-draft per lobby: scrap this team and draft a fresh one for the same
  // lobby. Consumes the single retry (persisted), then sends them back to draft.
  const reDraftForLobby = () => {
    const code = state?.lobbyCode;
    if (!code) return;
    if (
      !window.confirm(t("confirmReDraft"))
    ) {
      return;
    }
    try {
      window.localStorage.setItem(
        lobbyRetryKey(code),
        String((lobbyRetriesUsed ?? 0) + 1)
      );
    } catch {
      // storage unavailable — the retry still proceeds this session
    }
    setLobbyRetriesUsed((n) => (n ?? 0) + 1);
    dispatch({ type: "NEW_GAME", seed: freshSeed(), lobbyCode: code });
    router.push(mode.playPath);
  };

  // Saved teams get the canonical (named) card; unsaved drafts render one
  // on the fly server-side from the roster itself.
  const cardUrl =
    save.phase === "saved"
      ? `${save.url}/card`
      : `/api/draft-card?r=${encodeURIComponent(JSON.stringify(roster))}`;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* perfect-season celebration, timed to the record landing */}
      {perfect && !reducedMotion && <Confetti delay={COUNT_UP_SECONDS} />}

      {/* download image + save (device) + share icons, top right */}
      <div className="flex justify-end gap-2">
        <DownloadCardButton
          cardUrl={cardUrl}
          fileName="ultimate-draft-team-card.png"
          label=""
          ariaLabel={t("downloadCardAria")}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "rounded-full"
          )}
        />
        <Dialog
          open={localOpen}
          onOpenChange={(open) => {
            setLocalOpen(open);
            if (!open) {
              setLocalSaved(false);
              setDeviceError(null);
            }
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={t("saveToDeviceAria")}
                className="rounded-full"
              />
            }
          >
            <SaveIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="dark border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle>{t("deviceDialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("deviceDialogDescription")}
              </DialogDescription>
            </DialogHeader>
            {localSaved ? (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-emerald-400" /> {t("savedToDevice")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  value={localName}
                  maxLength={40}
                  placeholder={t("teamNamePlaceholder")}
                  aria-label={t("teamNameAria")}
                  className="h-11 rounded-xl"
                  onChange={(e) => {
                    setLocalName(e.target.value);
                    if (deviceError) setDeviceError(null);
                  }}
                />
                {deviceError && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {deviceError}
                  </p>
                )}
                <Button
                  className="h-12 w-full rounded-xl text-base font-bold"
                  disabled={localName.trim().length === 0}
                  onClick={saveToDevice}
                >
                  <SaveIcon className="size-4" /> {t("save")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) setShareError(null);
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={t("shareTeamAria")}
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
                  ? t("shareTitleLobby")
                  : state.challengeSlug
                    ? t("shareTitleChallenge")
                    : t("shareTitleDefault")}
              </DialogTitle>
              <DialogDescription>
                {state.lobbyCode
                  ? t("shareDescLobby", { code: state.lobbyCode })
                  : state.challengeSlug
                    ? t("shareDescChallenge")
                    : t("shareDescDefault")}
              </DialogDescription>
            </DialogHeader>
            {save.phase === "saved" ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">{t("shareLinkReady")}</p>
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
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
                <DownloadCardButton
                  cardUrl={`${save.url}/card`}
                  fileName="ultimate-draft-team-card.png"
                  label={t("saveYourTeam")}
                  className="mx-auto text-xs font-semibold text-primary underline-offset-2 hover:underline"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {state.lobbyCode && (
                  <Input
                    value={playerName}
                    maxLength={24}
                    placeholder={t("playerNamePlaceholder")}
                    aria-label={t("playerNameAria")}
                    className="h-11 rounded-xl"
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                )}
                <Input
                  value={teamName}
                  maxLength={40}
                  placeholder={t("teamNamePlaceholder")}
                  aria-label={t("teamNameAria")}
                  className="h-11 rounded-xl"
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    if (shareError) setShareError(null);
                  }}
                />
                {shareError && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {shareError}
                  </p>
                )}
                <Button
                  className="h-12 w-full rounded-xl text-base font-bold"
                  disabled={
                    save.phase === "saving" ||
                    teamName.trim().length === 0
                  }
                  onClick={saveTeam}
                >
                  {save.phase === "saving"
                    ? t("sharing")
                    : state.lobbyCode
                      ? t("enterLobby")
                      : state.challengeSlug
                        ? t("battle")
                        : t("share")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* shared reveal: record → roster → gate → OVR/OFF/DEF → 9-cat → cost → AI */}
      <TeamRevealBody
        roster={roster}
        rating={rating}
        season={season}
        cost={cost}
        players={players}
        benchSlots={mode.benchSlots}
        snapshotVersion={state.snapshotVersion}
      />

      {/* thumb-zone footer */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {state.lobbyCode && save.phase !== "saved" && (
          <>
            {/* One re-draft per lobby — hidden once it's been used. */}
            {lobbyRetriesUsed !== null && lobbyRetriesUsed < MAX_LOBBY_RETRIES && (
              <Button
                variant="outline"
                className="h-12 w-full rounded-2xl text-sm font-bold"
                onClick={reDraftForLobby}
              >
                <RotateCcw className="size-4" />{" "}
                {t("reDraft", { left: MAX_LOBBY_RETRIES - lobbyRetriesUsed })}
              </Button>
            )}
            <Button
              className="h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
              onClick={() => setShareOpen(true)}
            >
              <Users className="size-5" /> {t("submitTeam")}
            </Button>
            {/* Escape hatch: a stale lobby draft (lobbyCode persists on the
                device) shouldn't trap the team — detach and play free. */}
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-sm font-bold"
              onClick={() => {
                if (window.confirm(t("confirmExitLobby", { code: state.lobbyCode ?? "" }))) {
                  dispatch({ type: "LEAVE_LOBBY" });
                }
              }}
            >
              <LogOut className="size-4" /> {t("exitLobby")}
            </Button>
          </>
        )}
        {state.challengeSlug && !state.lobbyCode && save.phase !== "saved" && (
          <Button
            className="h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
            onClick={() => setShareOpen(true)}
          >
            <Swords className="size-5" /> {t("battleRival")}
          </Button>
        )}
        {/* Lobby drafts are one-shot: this team enters the lobby or nothing
            does — no re-rolling into a fresh draft. */}
        {!state.lobbyCode && (
          <Button
            variant="outline"
            className="h-14 w-full rounded-2xl text-lg font-bold"
            onClick={runItBack}
          >
            {t("runItBack")} <RotateCcw className="size-5" />
          </Button>
        )}
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
