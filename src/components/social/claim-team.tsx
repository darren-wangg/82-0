"use client";

/**
 * "Claim this team" affordance on the viewer's own unnamed leaderboard rows:
 * opens a dialog to put a GM name (and optionally a fresh team name) on the
 * team, then refreshes the page so the entry shows it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ClaimTeamButton({
  slug,
  teamName,
  className,
}: {
  slug: string;
  /** Current team name — prefills the rename field. */
  teamName: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [newTeamName, setNewTeamName] = useState(teamName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmedTeam = newTeamName.trim();
      const res = await fetch(`/api/teams/${slug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          ...(trimmedTeam && trimmedTeam !== teamName
            ? { teamName: trimmedTeam }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't claim the team right now — try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't claim the team right now — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "block text-left text-[11px] font-semibold text-primary underline-offset-2 hover:underline",
              className
            )}
          />
        }
      >
        Claim this team →
      </DialogTrigger>
      <DialogContent className="dark border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Claim your team</DialogTitle>
          <DialogDescription>
            Put your name on this leaderboard entry — and rename the team if
            you want.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            value={displayName}
            maxLength={24}
            placeholder="Your name (shown on the board)"
            aria-label="Your name"
            className="h-11 rounded-xl"
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            value={newTeamName}
            maxLength={40}
            placeholder="Team name"
            aria-label="Team name"
            className="h-11 rounded-xl"
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={busy || displayName.trim().length === 0}
            onClick={claim}
          >
            {busy ? "Claiming…" : "Claim"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
