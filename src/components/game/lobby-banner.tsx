"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact banner shown while drafting into a group lobby. Fetches the lobby's
 * name so the header reads by name; falls back to the code (styled as a code)
 * until — and unless — that resolves, since the draft still enters the lobby
 * from the code alone.
 */
export function LobbyBanner({
  code,
  onLeave,
}: {
  code: string;
  onLeave: () => void;
}) {
  const t = useTranslations("play");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lobbies/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((lobby: { name?: string } | null) => {
        if (!cancelled && lobby?.name) setName(lobby.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <motion.div
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
    </motion.div>
  );
}
