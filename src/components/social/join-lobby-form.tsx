"use client";

/**
 * Join a lobby with a saved team: accepts a raw team slug or a full /t/ link.
 * On success the server-rendered standings refresh in place.
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseTeamSlug } from "./parse-team-slug";

export function JoinLobbyForm({ code }: { code: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const teamSlug = parseTeamSlug(value);
    if (!teamSlug) {
      setError("Paste your team link or slug first");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/lobbies/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, teamSlug }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't join right now");
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      setError("Couldn't join right now");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Team link or slug"
          aria-label="Team link or slug"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
