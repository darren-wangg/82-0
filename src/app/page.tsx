import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { getTranslations } from "next-intl/server";
import { FlaskConical, Shirt, Trophy, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HowToPlayDialog } from "@/components/game/how-to-play";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ultimate Draft — Chase the perfect 82-0 season",
  description:
    "Spin for a team and an era, draft 8 players, and chase the perfect 82-0 season.",
};

const NAV_TILES = [
  {
    href: "/leaderboard",
    labelKey: "leaderboard",
    icon: Trophy,
    className:
      "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
  },
  {
    href: "/l",
    labelKey: "lobbies",
    icon: UsersRound,
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20",
  },
  {
    href: "/teams",
    labelKey: "myTeams",
    icon: Shirt,
    className:
      "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
  },
] as const;

export default async function Home() {
  const t = await getTranslations("home");
  // Warm the draft's data (~1.6 MB snapshot + fallback map, both cached
  // immutably) while the user reads the home screen — tapping Start Draft
  // then loads from the browser cache instead of fetching on /play mount.
  preload("/data/snapshot-v1.json", { as: "fetch" });
  preload("/data/headshot-fallbacks-v1.json", { as: "fetch" });
  return (
    <div className="dark relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* ambient court glow — pure CSS, decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 size-80 rounded-full bg-violet-500/10 blur-3xl"
      />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 pt-16 pb-10">
        <div className="flex animate-in flex-col items-center gap-4 text-center duration-700 fade-in slide-in-from-bottom-4">
          {/* NBA Jam fire: yellow → orange → red sweep */}
          <h1 className="animate-gradient-x bg-gradient-to-r from-amber-300 via-primary to-red-500 bg-[length:200%_auto] bg-clip-text text-center font-display text-6xl leading-[0.95] tracking-tight text-transparent uppercase">
            Ultimate
            <br />
            Draft
          </h1>
          <p className="max-w-xs text-base text-balance text-muted-foreground">
            {t.rich("tagline", {
              b: (chunks) => (
                <span className="font-semibold text-foreground">{chunks}</span>
              ),
            })}
          </p>
        </div>

        <div className="flex w-full animate-in flex-col items-center gap-3 pt-2 delay-150 duration-700 fade-in slide-in-from-bottom-4 fill-mode-both">
          <Link
            href="/play"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30 transition-transform active:scale-95"
            )}
          >
            {t("startDraft")}
          </Link>
          <div className="grid w-full grid-cols-3 gap-2">
            {NAV_TILES.map(({ href, labelKey, icon: Icon, className }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-center transition-[transform,background-color] active:scale-95",
                  className
                )}
              >
                <Icon className="size-5" />
                <span className="px-1 text-[11px] leading-tight font-semibold text-foreground">
                  {t(`nav.${labelKey}`)}
                </span>
              </Link>
            ))}
          </div>
          <HowToPlayDialog />

          {/* Beta: a longer 10-player draft, walled off from the main flow. */}
          <Link
            href="/play10"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 transition-transform active:scale-95"
          >
            <FlaskConical className="size-3.5" />
            {t("tenPlayerMode")}
            <span className="rounded bg-violet-400/20 px-1 py-px text-[9px] tracking-wider uppercase">
              {t("beta")}
            </span>
          </Link>

          <LanguageSwitcher className="mt-1" label={t("language")} />
        </div>

        {/* CC BY-SA attribution for the source dataset (required by license). */}
        <p className="mt-auto pt-6 text-center text-[10px] leading-relaxed text-muted-foreground/70">
          {t.rich("attribution", {
            link: (chunks) => (
              <a
                href="https://github.com/sumitrodatta/bball-reference-datasets"
                className="underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </main>
    </div>
  );
}
