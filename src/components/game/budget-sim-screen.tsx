"use client";

/**
 * Budget sim screen. Shows the *exact same* post-draft reveal as the classic
 * SimScreen (animated record count-up, roster headshots, OVR/OFF/DEF, 9-cat
 * profile, "what cost you", streamed AI scouting, plus download-card and
 * save-to-device actions) via the shared <TeamRevealBody>. The only budget
 * additions are the famous-team challenge / lobby submission flow:
 * name → pick a historical opponent → save to /api/budget/teams (server
 * validates the cap) → POST /api/matchups → redirect to /m/[id].
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Copy, Loader2, LogOut, RotateCcw, Save as SaveIcon, Users } from "lucide-react";
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
import { SEASON_GAMES, type SaveTeamResponse } from "@/lib/contracts";
import { containsProfanity } from "@/lib/profanity";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { isBudgetDifficulty, type BudgetDifficulty } from "@/lib/budget";
import { DownloadCardButton } from "@/components/social/download-card";
import { analyzeCost } from "./cost-analysis";
import { Confetti } from "./confetti";
import { toRoster } from "./draft-state";
import { freshSeed, useGame } from "./game-provider";
import { saveLocalTeam } from "./local-teams";
import { usePhaseGuard } from "./use-phase-guard";
import { COUNT_UP_SECONDS, TeamRevealBody } from "./team-reveal";

/** Read difficulty persisted by BudgetPlayScreen. */
function readDifficulty(): BudgetDifficulty {
  try {
    const v = window.localStorage.getItem("ud:budget/difficulty") ?? "";
    return isBudgetDifficulty(v) ? v : "normal";
  } catch {
    return "normal";
  }
}

/** Lobby entrants get one re-draft (async lobbies only — live drafts have no
 *  redos). Same per-lobby localStorage key the classic sim screen uses, so a
 *  retry burned in either mode counts once. */
const MAX_LOBBY_RETRIES = 1;
const lobbyRetryKey = (code: string) => `ud:lobby-retries:${code}`;

function SimSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4" aria-busy>
      <div className="flex justify-end gap-2">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <Skeleton className="mx-auto h-20 w-56" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function BudgetSimScreen() {
  const t = useTranslations("budget");
  const tSim = useTranslations("sim");
  const { state, dispatch, ctx, players } = useGame();
  const allowed = usePhaseGuard(["locked"]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [teamName, setTeamName] = useState("");
  // Lobby entries carry the entrant's name so the standings show whose team
  // is whose; remembered per device so it's typed once.
  const [playerName, setPlayerName] = useState("");
  const [difficultyState, setDifficulty] = useState<BudgetDifficulty>("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  // Cache the saved slug so navigating back and re-tapping Challenge reuses the
  // same persisted team instead of creating a duplicate row each time.
  const savedSlugRef = useRef<string | null>(null);
  // Explicit "save your team" result (solo flow): the /t/[slug] share link.
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Lobby re-draft: one per device per lobby (async only), tracked in
  // localStorage so it survives the NEW_GAME reset. null until read.
  const [lobbyRetriesUsed, setLobbyRetriesUsed] = useState<number | null>(null);

  // Save-to-device dialog (mirrors the classic sim screen).
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSaved, setLocalSaved] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Hydrate difficulty + player name from localStorage once on the client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration
    setDifficulty(readDifficulty());
    try {
      const stored = window.localStorage.getItem("ud:player-name");
       
      if (stored) setPlayerName(stored);
    } catch {
      // storage unavailable (private mode) — start blank
    }
  }, []);

  // Budget lobbies always play at Normal difficulty (the shared cap everyone
  // in the lobby drafts under), whatever a previous solo run left in storage.
  const lobbyCode = state?.lobbyCode ?? null;
  const difficulty: BudgetDifficulty = lobbyCode ? "normal" : difficultyState;

  // Read how many lobby re-drafts this device has already used (per lobby).
  useEffect(() => {
    if (!lobbyCode) return;
    let used = 0;
    try {
      used = Number(window.localStorage.getItem(lobbyRetryKey(lobbyCode))) || 0;
    } catch {
      // storage unavailable — treat as no retries used
    }
     
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration
    setLobbyRetriesUsed(used);
  }, [lobbyCode]);

  const sim = useMemo(() => {
    if (!state || state.status !== "locked") return null;
    const roster = toRoster(state);
    if (!roster) return null;
    const engine = getEngine();
    const rating = engine.teamRating(roster, players, getBaselines());
    const season = engine.projectSeason(rating);
    const cost = analyzeCost(roster, rating, season, players, getBaselines(), {
      considerBench: roster.bench.length > 3,
    });
    return { roster, rating, season, cost };
  }, [state, players]);

  const saveToDevice = () => {
    if (!state || !sim) return;
    const name = localName.trim();
    if (name.length === 0 || name.length > 40) {
      setDeviceError(tSim("toastNameRequired"));
      return;
    }
    if (containsProfanity(name)) {
      setDeviceError(tSim("nameRejected"));
      return;
    }
    setDeviceError(null);
    const ok = saveLocalTeam({
      name,
      roster: sim.roster,
      snapshotVersion: state.snapshotVersion,
      rating: sim.rating,
      season: sim.season,
    });
    if (!ok) {
      setDeviceError(tSim("toastDeviceSaveFailed"));
      return;
    }
    setLocalSaved(true);
  };

  // Save the budget team (server validates the cap). Returns the persisted
  // slug, reusing a previous save so navigating back and re-tapping doesn't
  // create a duplicate row. Null = failed (error state already set).
  const saveBudgetTeam = async (): Promise<string | null> => {
    if (!state || !sim) return null;
    if (savedSlugRef.current) return savedSlugRef.current;
    const saveRes = await fetch("/api/budget/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamName: teamName.trim(),
        roster: sim.roster,
        snapshotVersion: state.snapshotVersion,
        difficulty,
      }),
    });
    if (saveRes.status === 409) {
      setError(tSim("toastStaleData"));
      return null;
    }
    if (saveRes.status === 422) {
      const data = (await saveRes.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("budgetExceeded"));
      return null;
    }
    if (!saveRes.ok) throw new Error(`save failed: ${saveRes.status}`);
    const saveData: SaveTeamResponse = await saveRes.json();
    savedSlugRef.current = saveData.team.slug;
    return saveData.team.slug;
  };

  // Solo flow: persist the team without challenging anyone — it gets a share
  // link and lands on the budget leaderboard for its cap difficulty. Tapping
  // Challenge afterwards reuses the same saved row. A name is required here:
  // only explicitly named teams are listed on the budget boards.
  const saveTeamOnly = async () => {
    if (savingRef.current || !state || !sim) return;
    const name = teamName.trim();
    if (name.length === 0 || name.length > 40) {
      setError(tSim("toastNameRequired"));
      return;
    }
    if (containsProfanity(name)) {
      setError(tSim("nameRejected"));
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const slug = await saveBudgetTeam();
      if (slug) setSavedUrl(`/t/${slug}`);
    } catch {
      setError(tSim("toastSaveUnavailable"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the link itself is visible to long-press copy
    }
  };

  // Solo flow: save, then route to the dedicated opponent-picker screen. The
  // matchup itself is created there, on pick.
  const saveAndGoToChallenge = async () => {
    if (savingRef.current || !state || !sim) return;
    // Name is optional for budget challenges — only needed to appear named on
    // the leaderboard. Validate it only when the user actually typed one.
    const name = teamName.trim();
    if (name && containsProfanity(name)) {
      setError(tSim("nameRejected"));
      return;
    }
    setError(null);

    // Roster size (5 / 8 / 10) rides along so the opponent picker challenges
    // the matching famous-team preset.
    const size = ctx.mode?.draftRounds ?? 8;

    savingRef.current = true;
    setSaving(true);
    try {
      const slug = await saveBudgetTeam();
      if (slug) {
        router.push(
          `/budget/challenge?team=${encodeURIComponent(slug)}` +
            `&name=${encodeURIComponent(name)}&difficulty=${difficulty}&size=${size}`
        );
      }
    } catch {
      setError(t("challengeFailed"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Lobby flow: save, then enter the lobby (async) or finish the live draft,
  // mirroring the classic sim screen's lobby submission.
  const saveAndEnterLobby = async () => {
    if (savingRef.current || !state || !sim || !state.lobbyCode) return;
    // Lobby standings list teams by name, so a team name is required here
    // (unlike the solo challenge flow, where it's optional).
    const name = teamName.trim();
    if (name.length === 0 || name.length > 40) {
      setError(tSim("toastNameRequired"));
      return;
    }
    if (containsProfanity(name)) {
      setError(tSim("nameRejected"));
      return;
    }
    const displayName = playerName.trim().slice(0, 24) || undefined;
    if (displayName && containsProfanity(displayName)) {
      setError(tSim("nameRejected"));
      return;
    }
    setError(null);
    if (displayName) {
      try {
        window.localStorage.setItem("ud:player-name", displayName);
      } catch {
        // best-effort persistence only
      }
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const slug = await saveBudgetTeam();
      if (!slug) return;
      const l = state.lobbyLive
        ? await fetch(`/api/lobbies/${encodeURIComponent(state.lobbyCode)}/finish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamSlug: slug, displayName }),
          })
        : await fetch("/api/lobbies/enter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: state.lobbyCode, teamSlug: slug, displayName }),
          });
      if (l.ok) {
        // The team is locked into the lobby — clear the stored draft so this
        // "locked" game can't bounce the user back into the summary, then jump
        // to the lobby page (standings / live tracker).
        try {
          if (ctx.mode?.storageKey) {
            window.localStorage.removeItem(ctx.mode.storageKey);
          }
        } catch {
          // storage unavailable — nothing persisted to clear
        }
        router.push(`/l/${state.lobbyCode}`);
        return;
      }
      const err = (await l.json().catch(() => null)) as { error?: string } | null;
      setError(err?.error ?? tSim("toastLobbyEnterFailed"));
    } catch {
      setError(tSim("toastLobbyEnterFailed"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // One re-draft per async lobby: scrap this team and draft a fresh one for
  // the same lobby (consumes the persisted retry). Live drafts have no redos.
  const reDraftForLobby = () => {
    const code = state?.lobbyCode;
    if (!code || !window.confirm(tSim("confirmReDraft"))) return;
    try {
      window.localStorage.setItem(
        lobbyRetryKey(code),
        String((lobbyRetriesUsed ?? 0) + 1)
      );
    } catch {
      // storage unavailable — the retry still proceeds this session
    }
    setLobbyRetriesUsed((n) => (n ?? 0) + 1);
    savedSlugRef.current = null;
    dispatch({ type: "NEW_GAME", seed: freshSeed(), lobbyCode: code });
    router.push(`${ctx.mode?.playPath ?? "/budget/play"}?difficulty=normal`);
  };

  // The name inputs sit at the very bottom of the page, so iOS Safari scrolls
  // the document *past its end* to lift them above the keyboard — and often
  // strands it there when the keyboard closes, leaving a tall blank stretch
  // "below" the page. Snap the scroll back into range once the input blurs
  // (delayed a beat so the keyboard dismissal finishes first).
  const clampScrollAfterKeyboard = () => {
    window.setTimeout(() => {
      const max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      if (window.scrollY > max) window.scrollTo({ top: max });
    }, 80);
  };

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { roster, rating, season, cost } = sim;
  const perfect = season.wins === SEASON_GAMES;
  const cardUrl = `/api/draft-card?r=${encodeURIComponent(JSON.stringify(roster))}`;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {perfect && !reducedMotion && <Confetti delay={COUNT_UP_SECONDS} />}

      {/* download image + save (device), top right — same as the classic screen */}
      <div className="flex justify-end gap-2">
        <DownloadCardButton
          cardUrl={cardUrl}
          fileName="budget-team-card.png"
          label=""
          ariaLabel={tSim("downloadCardAria")}
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
                aria-label={tSim("saveToDeviceAria")}
                className="rounded-full"
              />
            }
          >
            <SaveIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="dark border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle>{tSim("deviceDialogTitle")}</DialogTitle>
              <DialogDescription>{tSim("deviceDialogDescription")}</DialogDescription>
            </DialogHeader>
            {localSaved ? (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-emerald-400" /> {tSim("savedToDevice")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  value={localName}
                  maxLength={40}
                  placeholder={tSim("teamNamePlaceholder")}
                  aria-label={tSim("teamNameAria")}
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
                  <SaveIcon className="size-4" /> {tSim("save")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* shared reveal — identical to the classic sim screen */}
      <TeamRevealBody
        roster={roster}
        rating={rating}
        season={season}
        cost={cost}
        players={players}
        benchSlots={ctx.mode?.benchSlots ?? []}
        snapshotVersion={state.snapshotVersion}
      />

      {/* budget footer: name field(s) + famous-team challenge / lobby flow.
          Flows after the reveal (not pinned) so the team stats keep the full
          viewport — scroll down to name and submit. */}
      <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {lobbyCode && (
          <Input
            value={playerName}
            maxLength={24}
            placeholder={tSim("playerNamePlaceholder")}
            aria-label={tSim("playerNameAria")}
            className="h-11 rounded-xl border-border bg-card dark:bg-card"
            onChange={(e) => setPlayerName(e.target.value)}
            onBlur={clampScrollAfterKeyboard}
          />
        )}
        <Input
          value={teamName}
          maxLength={40}
          placeholder={lobbyCode ? tSim("teamNamePlaceholder") : t("nameOptionalPlaceholder")}
          aria-label={tSim("teamNameAria")}
          // Once explicitly saved, the name is committed with the team row —
          // lock the field so edits don't look like they'd still apply.
          disabled={savedUrl !== null}
          className="h-11 rounded-xl border-border bg-card dark:bg-card"
          onChange={(e) => {
            setTeamName(e.target.value);
            if (error) setError(null);
          }}
          onBlur={clampScrollAfterKeyboard}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {lobbyCode ? (
          <>
            <Button
              className="h-14 w-full rounded-2xl font-display text-lg tracking-wide shadow-lg shadow-primary/30"
              disabled={saving}
              onClick={saveAndEnterLobby}
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Users className="size-5" /> {tSim("submitTeam")}
                </>
              )}
            </Button>
            {/* One re-draft per async lobby — hidden once used. Live lobbies
                are synced (everyone drafts at once), so there are no redos. */}
            {!state.lobbyLive &&
              lobbyRetriesUsed !== null &&
              lobbyRetriesUsed < MAX_LOBBY_RETRIES && (
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl text-sm font-bold"
                  disabled={saving}
                  onClick={reDraftForLobby}
                >
                  <RotateCcw className="size-4" />{" "}
                  {tSim("reDraft", { left: MAX_LOBBY_RETRIES - lobbyRetriesUsed })}
                </Button>
              )}
            {/* Escape hatch: a stale lobby draft shouldn't trap the team. */}
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-sm font-bold"
              disabled={saving}
              onClick={() => {
                if (window.confirm(tSim("confirmExitLobby", { code: lobbyCode }))) {
                  dispatch({ type: "LEAVE_LOBBY" });
                }
              }}
            >
              <LogOut className="size-4" /> {tSim("exitLobby")}
            </Button>
          </>
        ) : (
          <>
            <Button
              className="h-14 w-full rounded-2xl font-display text-lg tracking-wide shadow-lg shadow-primary/30"
              disabled={saving}
              onClick={saveAndGoToChallenge}
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  {t("challengeCta")} <ChevronRight className="size-5" />
                </>
              )}
            </Button>
            {/* Save without challenging: share link + budget-leaderboard entry
                (ranked against teams built under the same cap). */}
            {savedUrl ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-sm font-semibold">{tSim("shareLinkReady")}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2.5 py-2 font-mono text-xs">
                    {savedUrl}
                  </code>
                  <Button
                    variant="outline"
                    className="h-10 shrink-0"
                    onClick={() => copyLink(savedUrl)}
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? tSim("copied") : tSim("copy")}
                  </Button>
                </div>
                <Link
                  href={`/leaderboard?board=budget${difficulty === "normal" ? "" : `&difficulty=${difficulty}`}`}
                  className="text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {t("viewLeaderboard")} →
                </Link>
              </div>
            ) : (
              <Button
                variant="outline"
                className="h-12 w-full rounded-2xl text-sm font-bold"
                disabled={saving}
                onClick={saveTeamOnly}
              >
                <SaveIcon className="size-4" /> {tSim("saveYourTeam")}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-sm font-bold"
              disabled={saving}
              onClick={() => {
                // Back to the difficulty selector for a fresh run. We clear the
                // persisted budget game instead of dispatching NEW_GAME here: a
                // reset flips the phase to "draft", and this screen's phase guard
                // ("locked") would then race us to /budget/play at the default $100
                // cap before our push to the selector lands. Clearing storage lets
                // the next /budget/play mount start a brand-new draft at the cap the
                // user re-picks.
                try {
                  if (ctx.mode?.storageKey) {
                    window.localStorage.removeItem(ctx.mode.storageKey);
                  }
                } catch {
                  // storage unavailable — a fresh game is still created on mount
                }
                router.push("/budget");
              }}
            >
              {t("redraft")} <RotateCcw className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
