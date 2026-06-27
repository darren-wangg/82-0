"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LobbyResponse } from "@/lib/contracts";
import { DEFAULT_TEAM_SIZE, TEAM_SIZES, type TeamSize } from "@/lib/team-size";
import { cn } from "@/lib/utils";

export function CreateLobbyForm({
  defaultSize = DEFAULT_TEAM_SIZE,
}: {
  defaultSize?: TeamSize;
}) {
  const t = useTranslations("lobby");
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize>(defaultSize);
  const [capped, setCapped] = useState(false);
  const [limit, setLimit] = useState("8");
  const [live, setLive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedLimit = capped ? Number(limit) : null;
    if (capped && (!Number.isInteger(parsedLimit) || parsedLimit! < 2 || parsedLimit! > 50)) {
      setError(t("limitError"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, limit: parsedLimit, teamSize, isLive: live }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const lobby: LobbyResponse = await res.json();
      router.push(`/l/${lobby.code}`);
    } catch {
      setError(t("createError"));
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <Input
        value={name}
        maxLength={40}
        placeholder={t("namePlaceholder")}
        aria-label={t("nameAria")}
        className="h-11 rounded-xl"
        onChange={(e) => setName(e.target.value)}
      />

      {/* Team size: 5 (starters only), 8 (classic, default), or 10 (deep bench). */}
      <div className="rounded-xl border border-border/70 px-3 py-2.5">
        <p className="mb-2 text-sm font-medium">{t("teamSize")}</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("teamSize")}>
          {TEAM_SIZES.map((size) => {
            const active = teamSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => setTeamSize(size)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary/70 bg-primary/15 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span className="font-bold">{t("manCount", { size })}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 px-3 py-2.5">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">{t("live")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("liveHint")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="size-4 accent-primary"
            aria-label={t("live")}
          />
        </label>
      </div>

      <div className="rounded-xl border border-border/70 px-3 py-2.5">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">{t("limitTeams")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("limitHint")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={capped}
            onChange={(e) => setCapped(e.target.checked)}
            className="size-4 accent-primary"
            aria-label={t("limitAria")}
          />
        </label>
        {capped && (
          <div className="mt-2.5 flex items-center gap-2">
            <Input
              type="number"
              min={2}
              max={50}
              value={limit}
              aria-label={t("maxTeamsAria")}
              className="h-9 w-20 rounded-lg"
              onChange={(e) => setLimit(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">{t("maxTeamsHint")}</span>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-base font-bold"
        disabled={pending || name.trim().length === 0}
      >
        {pending ? t("creating") : t("createLobby")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
