import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { preload } from "react-dom";
import { getTranslations } from "next-intl/server";
import { DollarSign, MessageSquarePlus, Shirt, Trophy, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HowToPlayDialog } from "@/components/game/how-to-play";
import { SoundToggle } from "@/components/sound-toggle";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { PLAY_PATH, resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ultimate Draft — Chase the perfect 82-0 season",
  description:
    "Spin for a team and an era, draft 8 players, and chase the perfect 82-0 season.",
};

// Premium-sleek wayfinding: cohesive elevated cards (one surface), with color
// carried by the accent icon + a hover glow rather than full tinted fills.
const NAV_TILES = [
  {
    href: "/leaderboard",
    labelKey: "leaderboard",
    icon: Trophy,
    iconClass: "text-amber-300",
    glow: "hover:border-amber-400/50 hover:shadow-amber-400/20 hover:bg-amber-400/[0.07]",
  },
  {
    href: "/l",
    labelKey: "lobbies",
    icon: UsersRound,
    iconClass: "text-sky-300",
    glow: "hover:border-sky-400/50 hover:shadow-sky-400/20 hover:bg-sky-400/[0.07]",
  },
  {
    href: "/teams",
    labelKey: "myTeams",
    icon: Shirt,
    iconClass: "text-emerald-300",
    glow: "hover:border-emerald-400/50 hover:shadow-emerald-400/20 hover:bg-emerald-400/[0.07]",
  },
] as const;

export default async function Home() {
  const t = await getTranslations("home");
  // Warm the draft's data (~1.6 MB snapshot + fallback map, both cached
  // immutably) while the user reads the home screen — tapping Start Draft
  // then loads from the browser cache instead of fetching on /play mount.
  preload("/data/snapshot-v1.json", { as: "fetch" });
  preload("/data/headshot-fallbacks-v1.json", { as: "fetch" });
  // Session team-size preference drives where Start Draft goes (5/8/10).
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  // Optional hosted feedback form (Tally/Formspree/etc.). The button only
  // shows when a URL is configured, so there's no dead link in dev/preview.
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  return (
    <div className="dark relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* ambient court glow — pure CSS, decorative only; the blobs drift slowly
          (disabled under prefers-reduced-motion) for a subtle living backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2"
      >
        <div className="size-96 animate-float rounded-full bg-primary/15 blur-3xl" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 size-80 animate-float-slow rounded-full bg-violet-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-28 size-72 animate-float rounded-full bg-sky-500/10 blur-3xl"
      />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 pt-16 pb-10">
        <div className="absolute right-5 top-[max(1rem,env(safe-area-inset-top))] z-10">
          <SoundToggle />
        </div>
        <div className="flex animate-in flex-col items-center gap-4 text-center duration-700 fade-in slide-in-from-bottom-4">
          {/* NBA Jam fire: yellow → orange → red sweep */}
          <h1 className="animate-gradient-x bg-gradient-to-r from-amber-300 via-primary to-red-500 bg-[length:200%_auto] bg-clip-text text-center font-display text-6xl leading-[0.95] tracking-tight text-transparent uppercase">
            Ultimate
            <br />
            Draft
          </h1>
          <p className="max-w-xs text-base text-balance text-muted-foreground">
            {t.rich("tagline", {
              size: teamSize,
              b: (chunks) => (
                <span className="font-semibold text-foreground">{chunks}</span>
              ),
            })}
          </p>
        </div>

        <div className="flex w-full animate-in flex-col items-center gap-5 pt-2 delay-150 duration-700 fade-in slide-in-from-bottom-4 fill-mode-both">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t("teamSize")}
            </span>
            <TeamSizeSwitch value={teamSize} />
          </div>
          <Link
            href={PLAY_PATH[teamSize]}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30 transition-transform active:scale-95"
            )}
          >
            {t("startDraft")}
          </Link>
          <div className="grid w-full grid-cols-3 gap-2">
            {NAV_TILES.map(({ href, labelKey, icon: Icon, iconClass, glow }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-card/70 text-center shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-95",
                  glow
                )}
              >
                <Icon
                  className={cn(
                    "size-5 transition-transform duration-200 group-hover:scale-110",
                    iconClass
                  )}
                />
                <span className="px-1 text-[11px] leading-tight font-semibold text-foreground">
                  {t(`nav.${labelKey}`)}
                </span>
              </Link>
            ))}
          </div>
          <HowToPlayDialog />

          {/* Budget Draft — compact Beta chip, beneath the primary modes */}
          <Link
            href="/budget"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-[transform,background-color] active:scale-95 hover:bg-violet-400/20"
          >
            <DollarSign className="size-3.5 shrink-0" />
            {t("nav.budget")}
            <Badge
              variant="outline"
              className="border-violet-400/60 bg-violet-400/10 px-1 py-0 text-[9px] font-bold text-violet-300"
            >
              Beta
            </Badge>
          </Link>

          <LanguageSwitcher className="mt-1" label={t("language")} />
        </div>

        {/* Bottom-anchored footer: feedback (bottom-right) above the disclaimer. */}
        <div className="mt-auto w-full pt-6">
          {feedbackUrl && (
            <div className="flex w-full justify-end">
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageSquarePlus aria-hidden className="size-3.5" />
                {t("feedback")}
              </a>
            </div>
          )}

          {/* CC BY-SA attribution for the source dataset (required by license). */}
          <p className="pt-4 text-center text-[10px] leading-relaxed text-muted-foreground/70">
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
        </div>
      </main>
    </div>
  );
}
