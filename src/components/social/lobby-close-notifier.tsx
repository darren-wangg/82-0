"use client";

/**
 * In-app "lobby ended" notification for entrants. No push infra: while a
 * member has the lobby page open we poll for the close, and the moment the
 * creator ends it we pop a toast with their final placement and refresh into
 * the closed view. The toast survives that refresh via a sessionStorage
 * handoff, so the person watching at the close sees it; everyone else sees the
 * persistent placement banner the closed page renders.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PartyPopper } from "lucide-react";

const POLL_MS = 12_000;

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function LobbyCloseNotifier({
  code,
  open,
  entered,
  placement,
  total,
  lobbyName,
}: {
  code: string;
  open: boolean;
  entered: boolean;
  /** Viewer's 1-based rank when closed + entered, else null. */
  placement: number | null;
  total: number;
  lobbyName: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const flagKey = `ud:lobby-closed:${code}`;

  // While open: poll for the creator closing the lobby.
  useEffect(() => {
    if (!open || !entered) return;
    let active = true;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (active && data.status === "closed") {
          // Hand off to the closed-phase mount so the toast survives refresh.
          try {
            sessionStorage.setItem(flagKey, "1");
          } catch {
            // sessionStorage unavailable — the placement banner still shows.
          }
          router.refresh();
        }
      } catch {
        // Transient — try again next tick.
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [open, entered, code, flagKey, router]);

  // After the refresh into the closed view: fire the toast once. The actual
  // setState runs in a timeout callback (post-hydration, and not a synchronous
  // setState inside the effect body).
  useEffect(() => {
    if (open || !entered || placement === null) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(flagKey) === "1";
      if (pending) sessionStorage.removeItem(flagKey);
    } catch {
      // ignore
    }
    if (!pending) return;
    const message =
      placement === 1
        ? `"${lobbyName}" has ended — you won the lobby! 🏆`
        : `"${lobbyName}" has ended — you finished ${ordinal(placement)} of ${total}.`;
    const id = window.setTimeout(() => setToast(message), 0);
    return () => window.clearTimeout(id);
  }, [open, entered, placement, total, lobbyName, flagKey]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          role="status"
          onClick={() => setToast(null)}
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-2.5 rounded-xl border border-border bg-popover px-4 py-3 text-sm font-medium text-popover-foreground shadow-lg"
        >
          <PartyPopper className="size-4 shrink-0 text-primary" />
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
