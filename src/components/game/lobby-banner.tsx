"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { m } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAME_CACHE_PREFIX = "ud:lobby-name:";

/** Session-cache a lobby's name so the draft banner shows it on first render
 *  instead of flashing the raw code while the lookup below resolves. The lobby
 *  page seeds this on every visit (the normal path into a lobby draft). */
export function cacheLobbyName(code: string, name: string) {
  try {
    window.sessionStorage.setItem(NAME_CACHE_PREFIX + code, name);
  } catch {
    // storage unavailable — the banner falls back to fetching by code
  }
}

function loadCachedLobbyName(code: string): string | null {
  try {
    return window.sessionStorage.getItem(NAME_CACHE_PREFIX + code);
  } catch {
    return null;
  }
}

/**
 * Compact banner shown while drafting into a group lobby. Reads the lobby's
 * name from the session cache (seeded by the lobby page) so the first render
 * already shows it; only drafts entered without visiting the lobby page fall
 * back to a fetch, showing the code (styled as a code) until that resolves.
 */
export function LobbyBanner({
  code,
  onLeave,
}: {
  code: string;
  onLeave: () => void;
}) {
  const t = useTranslations("play");
  const [name, setName] = useState<string | null>(() =>
    loadCachedLobbyName(code)
  );

  useEffect(() => {
    if (name !== null) return; // seeded via cacheLobbyName — nothing to fetch
    let cancelled = false;
    fetch(`/api/lobbies/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((lobby: { name?: string } | null) => {
        if (!cancelled && lobby?.name) {
          setName(lobby.name);
          cacheLobbyName(code, lobby.name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, name]);

  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1.5 text-xs"
    >
      <Users className="size-3.5 shrink-0 text-sky-300" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {t("lobbyDraft")} —{" "}
          <span
            className={cn(
              "font-bold text-sky-300",
              name ? "tracking-wide" : "font-mono tracking-widest"
            )}
          >
            {name ?? code}
          </span>
        </span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline"
        onClick={onLeave}
      >
        {t("leave")}
      </button>
    </m.div>
  );
}
