"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LobbyResponse } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export function CreateLobbyForm() {
  const t = useTranslations("lobby");
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState<8 | 10>(8);
  const [capped, setCapped] = useState(false);
  const [limit, setLimit] = useState("8");
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
        body: JSON.stringify({ name: trimmed, limit: parsedLimit, teamSize }),
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

      {/* Team size: 8-man normal (default) vs the 10-player beta. */}
      <div className="rounded-xl border border-border/70 px-3 py-2.5">
        <p className="mb-2 text-sm font-medium">{t("teamSize")}</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("teamSize")}>
          {([8, 10] as const).map((size) => {
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
                    ? size === 10
                      ? "border-violet-400/70 bg-violet-400/15 text-violet-200"
                      : "border-primary/70 bg-primary/15 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <span className="font-bold">{t("manCount", { size })}</span>
                <span className="text-[11px]">
                  {size === 8 ? t("normal") : t("beta")}
                </span>
              </button>
            );
          })}
        </div>
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
