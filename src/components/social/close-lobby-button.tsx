"use client";

/** Creator-only: end the lobby early and crown the current leader. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CloseLobbyButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async () => {
    if (!window.confirm("End this lobby now? Entries close and the leader is crowned.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't end the lobby right now");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't end the lobby right now");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full space-y-1">
      <Button
        className="h-12 w-full rounded-xl bg-emerald-600/90 text-base font-bold text-emerald-50 hover:bg-emerald-600"
        disabled={pending}
        onClick={close}
      >
        {pending ? "Closing..." : "Close lobby + crown champ"}
      </Button>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
