/**
 * /teams — teams saved to this device (localStorage only, no server copy),
 * newest first. The list itself is a client component.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getSnapshot } from "@/lib/snapshot";
import { MyTeams } from "@/components/social/my-teams";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";

export const metadata: Metadata = {
  title: "My teams",
  description: "Teams you've saved on this device.",
};

export default async function TeamsPage() {
  const t = await getTranslations("home");
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">My teams</h1>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="font-arcade text-[8px] text-muted-foreground uppercase">
            {t("teamSize")}
          </span>
          <TeamSizeSwitch value={teamSize} />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Saved on this device only.
      </p>
      {/* Version passed from the server so the client needn't fetch the snapshot. */}
      <MyTeams snapshotVersion={getSnapshot().version} teamSize={teamSize} />
    </main>
  );
}
