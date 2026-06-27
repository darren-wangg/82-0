"use client";

/**
 * Live lobby room — the waiting room and live draft tracker for a live lobby.
 *
 * Phases (polled via useLiveLobby):
 *   waiting  — joined players list + a Join form for newcomers + a creator-only
 *              Start button (enabled at ≥2 players).
 *   drafting — a live progress bar per player (the "watch each other draft"
 *              payoff) + a CTA to go draft (or "waiting for others" once done).
 *   results  — refresh into the existing standings/round-robin view.
 *
 * Standings, champion crowning, and the reveal all run on the existing async
 * lobby path once the lobby closes — this component only adds the live layer.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Radio, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CopyCode } from "@/components/social/copy-code";
import { ShareButton } from "@/components/social/share-button";
import type { LiveLobbyState } from "@/lib/live-lobby";
import { PLAY_PATH, resolveTeamSize } from "@/lib/team-size";
import { cn } from "@/lib/utils";
import { useLiveLobby } from "./use-live-lobby";

export function LiveLobbyRoom({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const { state, error } = useLiveLobby(code);

  // Once everyone's finished, the lobby closes → re-render into standings.
  useEffect(() => {
    if (state?.phase === "results") router.refresh();
  }, [state?.phase, router]);

  if (error && !state) {
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Couldn&apos;t reach this lobby. Retrying…
      </p>
    );
  }
  if (!state) {
    return (
      <div className="mt-10 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="space-y-5">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-primary uppercase">
          <Radio className="size-3" /> Live
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight">{name}</h1>
        <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CopyCode code={code} />
        </p>
      </div>

      {state.phase === "waiting" ? (
        <WaitingRoom code={code} state={state} />
      ) : (
        <DraftTracker code={code} state={state} />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ waiting */

function WaitingRoom({
  code,
  state,
}: {
  code: string;
  state: LiveLobbyState;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name we last used (sim screen stores it too).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ud:player-name");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate once from storage
      if (saved) setName(saved);
    } catch {
      // ignore
    }
  }, []);

  const join = async () => {
    const displayName = name.trim();
    if (!displayName || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't join — try again.");
        return;
      }
      try {
        window.localStorage.setItem("ud:player-name", displayName);
      } catch {
        // best effort
      }
      router.refresh();
    } catch {
      setError("Couldn't join — try again.");
    } finally {
      setPending(false);
    }
  };

  const start = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't start the draft.");
      }
      // Success flips the phase on the next poll → DraftTracker takes over.
    } catch {
      setError("Couldn't start the draft.");
    } finally {
      setPending(false);
    }
  };

  const count = state.participants.length;

  return (
    <>
      <PlayerList state={state} />

      {!state.viewer.joined ? (
        <div className="space-y-2">
          <Input
            value={name}
            maxLength={24}
            placeholder="Your name"
            aria-label="Your name"
            className="h-11 rounded-xl"
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
          <Button
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={name.trim().length === 0 || pending}
            onClick={join}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <><UserRoundPlus className="size-4" /> Join lobby</>}
          </Button>
        </div>
      ) : state.viewer.isCreator ? (
        <div className="space-y-1.5">
          <Button
            className="h-12 w-full rounded-2xl font-display text-lg tracking-wide shadow-lg shadow-primary/30"
            disabled={count < 2 || pending}
            onClick={start}
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : "Start draft"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {count < 2 ? "Waiting for at least 2 players…" : `Start when everyone's in (${count} here).`}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="py-4 text-center text-sm">
            You&apos;re in! Waiting for the host to start the draft…
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <ShareButton
        title={`Join my live "${state.name}" draft on Ultimate Draft`}
        path={`/l/${code}`}
        label="Invite friends"
        className={cn("w-full", count < 2 && "border-primary/60 text-primary")}
      />
    </>
  );
}

/* ----------------------------------------------------------------- drafting */

function DraftTracker({
  code,
  state,
}: {
  code: string;
  state: LiveLobbyState;
}) {
  // Draft through the flow matching the lobby's roster size (5 / 8 / 10), same
  // as the async lobby page; the play screen reports progress back as it fills.
  const draftPath = PLAY_PATH[resolveTeamSize(String(state.rosterSize))];
  const draftHref = `${draftPath}?lobby=${encodeURIComponent(code)}&live=1`;

  return (
    <>
      <p className="text-center text-xs font-semibold tracking-wide text-primary uppercase">
        Drafting live
      </p>

      <PlayerList state={state} showProgress />

      {state.viewer.joined && !state.viewer.done ? (
        <a
          href={draftHref}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary font-display text-lg tracking-wide text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.99]"
        >
          {state.viewer.teamSlug ? "Back to your draft" : "Draft your team"}
        </a>
      ) : state.viewer.done ? (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex items-center justify-center gap-2 py-4 text-sm font-semibold">
            <Check className="size-4 text-emerald-400" /> Your team&apos;s in — waiting for the rest…
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            This draft is already underway — hang tight for the results.
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- shared */

function PlayerList({
  state,
  showProgress = false,
}: {
  state: LiveLobbyState;
  showProgress?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {state.participants.map((p, i) => {
        const pct = Math.min(100, Math.round((p.picksCount / state.rosterSize) * 100));
        return (
          <li
            key={`${p.displayName}-${i}`}
            className={cn(
              "rounded-xl border px-3 py-2.5 shadow-sm",
              p.isViewer ? "border-primary/50 bg-primary/10" : "border-border/80 bg-card/70"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {p.displayName}
                {p.isCreator && (
                  <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Host
                  </span>
                )}
              </span>
              {showProgress &&
                (p.done ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <Check className="size-3.5" /> Done
                  </span>
                ) : (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {p.picksCount}/{state.rosterSize}
                  </span>
                ))}
            </div>
            {showProgress && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    p.done ? "bg-emerald-400" : "bg-primary"
                  )}
                  style={{ width: `${p.done ? 100 : pct}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
      {state.participants.length === 0 && (
        <li className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
          No one&apos;s joined yet — share the code to fill the room.
        </li>
      )}
    </ul>
  );
}
