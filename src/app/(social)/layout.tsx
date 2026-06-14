/**
 * Shared layout for the social surfaces (/t, /m, /l): dark, sporty,
 * mobile-first single column capped at max-w-md.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PLAY_PATH, resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";

export const metadata: Metadata = {
  title: { default: "Ultimate Draft", template: "%s — Ultimate Draft" },
  description:
    "Draft an 8-player all-time NBA roster and see how close to 82-0 it gets.",
};

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  // Route Play to the draft for the selected team size, not always the 8-man flow.
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  return (
    <div className="dark flex w-full flex-1 flex-col items-center bg-background font-sans text-foreground">
      <div className="flex w-full max-w-md flex-1 flex-col px-4 pb-12 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/" className="font-display text-sm tracking-wide uppercase">
            <span className="text-primary">Ultimate</span>{" "}
            <span className="text-foreground">Draft</span>
          </Link>
          <Link
            href={PLAY_PATH[teamSize]}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Play →
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
