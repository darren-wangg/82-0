"use client";

/** Creator-only: set, change, or clear the lobby's team limit after creation. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LobbyLimitEditor({
  code,
  currentLimit,
  entrantCount,
}: {
  code: string;
  currentLimit: number | null;
  entrantCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentLimit ?? Math.max(entrantCount, 8)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (limit: number | null) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't update the limit right now");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't update the limit right now");
    } finally {
      setPending(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pencil className="size-3" />
        {currentLimit === null ? "Set a team limit" : "Change team limit"}
      </button>
    );
  }

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 2 && parsed <= 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={2}
          max={50}
          value={value}
          aria-label="Maximum teams"
          className="h-9 w-20 rounded-lg"
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          className="h-9"
          disabled={pending || !valid}
          onClick={() => save(parsed)}
        >
          Save
        </Button>
        {currentLimit !== null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-muted-foreground"
            disabled={pending}
            onClick={() => save(null)}
          >
            Remove
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-9"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        2–50 teams, or remove for unlimited.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
