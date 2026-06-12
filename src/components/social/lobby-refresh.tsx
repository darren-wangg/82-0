"use client";

/** "Open" status chip that doubles as a manual refresh: tapping it re-renders
 *  the server page so new entries show up. No background polling. */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function LobbyRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Refresh standings"
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 transition-opacity active:opacity-70"
    >
      <span className="size-2 rounded-full bg-emerald-400" />
      Active
      <RefreshCw
        className={cn("size-3 text-muted-foreground", pending && "animate-spin")}
      />
    </button>
  );
}
