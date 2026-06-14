import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { preload } from "react-dom";
import { Shirt, Trophy, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HowToPlayDialog } from "@/components/game/how-to-play";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { PLAY_PATH, resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ultimate Draft — Chase the perfect 82-0 season",
  description:
    "Spin for a team and an era, draft 8 players, and chase the perfect 82-0 season.",
};

const NAV_TILES = [
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    className:
      "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
  },
  {
    href: "/l",
    label: "Lobbies",
    icon: UsersRound,
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20",
  },
  {
    href: "/teams",
    label: "My Teams",
    icon: Shirt,
    className:
      "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
  },
] as const;

export default async function Home() {
  // Warm the draft's data (~1.6 MB snapshot + fallback map, both cached
  // immutably) while the user reads the home screen — tapping Start Draft
  // then loads from the browser cache instead of fetching on /play mount.
  preload("/data/snapshot-v1.json", { as: "fetch" });
  preload("/data/headshot-fallbacks-v1.json", { as: "fetch" });
  // Session team-size preference drives where Start Draft goes (5/8/10).
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
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
            Spin for a team and an era, draft 8 players, and chase the
            perfect <span className="font-semibold text-foreground">82-0</span>{" "}
            season.
          </p>
        </div>

        <div className="flex w-full animate-in flex-col items-center gap-3 pt-2 delay-150 duration-700 fade-in slide-in-from-bottom-4 fill-mode-both">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Team size
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
            Start Draft
          </Link>
          <div className="grid w-full grid-cols-3 gap-2">
            {NAV_TILES.map(({ href, label, icon: Icon, className }) => (
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
                  {label}
                </span>
              </Link>
            ))}
          </div>
          <HowToPlayDialog />
        </div>

        {/* CC BY-SA attribution for the source dataset (required by license). */}
        <p className="mt-auto pt-6 text-center text-[10px] leading-relaxed text-muted-foreground/70">
          Stats derived from the{" "}
          <a
            href="https://github.com/sumitrodatta/bball-reference-datasets"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            NBA Stats (1947–present)
          </a>{" "}
          dataset by Sumitro Datta (CC BY-SA 4.0). Not affiliated with the NBA.
        </p>
      </main>
    </div>
  );
}
