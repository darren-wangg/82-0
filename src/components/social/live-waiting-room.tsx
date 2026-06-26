"use client";

/**
 * Waiting room and drafting-state UI for live lobbies.
 *
 * - Waiting phase: shows participant list (polled), Join button for newcomers,
 *   and a creator-only Start draft button (enabled at ≥2 participants).
 * - Drafting phase: redirects participants to the draft; others see a status message.
 * - Results phase: redirects to the lobby page (standings).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLiveLobbyPoll } from "./live-lobby-poll";

const MIN_TO_START = 2;

export function LiveWaitingRoom({
  code,
  isCreator,
  isParticipant: initialIsParticipant,
  draftPath,
  teamLimit,
  lobbyName,
}: {
  code: string;
  isCreator: boolean;
  isParticipant: boolean;
  draftPath: string;
  teamLimit: number | null;
  lobbyName: string;
}) {
  const t = useTranslations("lobby");
  const router = useRouter();
  const liveState = useLiveLobbyPoll(code);

  // Join form state
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(initialIsParticipant);

  // Starting state (creator)
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Restore remembered name
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ud:player-name");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted name once on mount
      if (stored) setDisplayName(stored);
    } catch {
      // storage unavailable
    }
  }, []);

  // When the phase transitions to drafting or results, navigate.
  useEffect(() => {
    if (!liveState) return;
    if (liveState.phase === "drafting" && isParticipant) {
      // Mark lobby as live in localStorage so sim-screen knows retries=0.
      try {
        window.localStorage.setItem(`ud:lobby-live:${code}`, "1");
      } catch {
        // best-effort
      }
      router.push(`${draftPath}?lobby=${encodeURIComponent(code)}`);
    }
    if (liveState.phase === "results") {
      router.refresh();
    }
  }, [liveState, isParticipant, draftPath, code, router]);

  const participants = liveState?.participants ?? [];
  const participantCount = participants.length;
  const full = teamLimit !== null && participantCount >= teamLimit;

  const join = async () => {
    const name = displayName.trim().slice(0, 24);
    if (!name) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (res.ok) {
        try {
          window.localStorage.setItem("ud:player-name", name);
          // Mark this lobby as live so sim-screen disables re-drafts.
          window.localStorage.setItem(`ud:lobby-live:${code}`, "1");
        } catch {
          // best-effort
        }
        setIsParticipant(true);
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setJoinError(err?.error ?? t("joinError"));
      }
    } catch {
      setJoinError(t("joinError"));
    } finally {
      setJoining(false);
    }
  };

  const startDraft = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setStartError(err?.error ?? t("startError"));
      }
      // On success the poll will detect phase==="drafting" and redirect.
    } catch {
      setStartError(t("startError"));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Participant list */}
      <Card>
        <CardContent className="py-3">
          <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            {t("waitingRoom")}
            {teamLimit !== null && (
              <span className="ml-1 tabular-nums text-muted-foreground/70">
                ({participantCount}/{teamLimit})
              </span>
            )}
          </p>
          {participants.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noPlayersYet")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {participants.map((p) => (
                <li
                  key={p.displayName}
                  className="flex items-center gap-2 text-sm"
                >
                  <Users className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{p.displayName}</span>
                  {p.done && (
                    <Check className="ml-auto size-3 shrink-0 text-emerald-500" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Join form (non-participants only, waiting phase only) */}
      {!isParticipant && !full && liveState?.phase !== "drafting" && (
        <div className="flex flex-col gap-2">
          <Input
            value={displayName}
            maxLength={24}
            placeholder={t("yourNamePlaceholder")}
            aria-label={t("yourNameAria")}
            className="h-11 rounded-xl"
            onChange={(e) => setDisplayName(e.target.value)}
          />
          {joinError && (
            <p role="alert" className="text-sm text-destructive">
              {joinError}
            </p>
          )}
          <Button
            className="h-12 w-full rounded-2xl text-base font-bold"
            disabled={joining || displayName.trim().length === 0}
            onClick={join}
          >
            {joining ? t("joining") : t("joinLive")}
          </Button>
        </div>
      )}

      {/* Joined confirmation */}
      {isParticipant && liveState?.phase === "waiting" && (
        <Card>
          <CardContent className="py-3 text-center text-sm">
            <p className="font-semibold text-emerald-400">
              {t("joinedWaiting")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("waitingForOwner")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Full lobby */}
      {full && !isParticipant && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-3 text-center text-sm font-semibold text-amber-400">
            {t("lobbyFull")}
          </CardContent>
        </Card>
      )}

      {/* Creator controls */}
      {isCreator && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          {startError && (
            <p role="alert" className="text-sm text-destructive">
              {startError}
            </p>
          )}
          <Button
            className={cn(
              "h-12 w-full rounded-2xl font-bold",
              participantCount < MIN_TO_START && "opacity-60"
            )}
            disabled={starting || participantCount < MIN_TO_START}
            onClick={startDraft}
          >
            {starting ? t("starting") : t("startDraft")}
          </Button>
          {participantCount < MIN_TO_START && (
            <p className="text-center text-xs text-muted-foreground">
              {t("startHint", { need: MIN_TO_START - participantCount })}
            </p>
          )}
        </div>
      )}

      {/* Share to invite */}
      <p className="text-center text-[11px] text-muted-foreground">
        {t("inviteHint", { name: lobbyName })}
      </p>
    </div>
  );
}
