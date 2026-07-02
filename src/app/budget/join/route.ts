/**
 * GET /budget/join?lobby={code}&size={5|8|10}[&live=1] — budget-lobby draft
 * entry point.
 *
 * Classic lobbies bind roster size to the route (/play5, /play, /play10), but
 * budget drafts share one route pair whose (budget) layout reads the global
 * ud:team-size cookie. A lobby's size is fixed by its creator, so this handler
 * pins the cookie to the lobby's size first, then forwards to /budget/play —
 * otherwise a visitor whose preference is 5 would mount a 5-man draft for an
 * 8-man lobby. Budget lobbies always play at Normal difficulty.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lobby = params.get("lobby") ?? "";
  const size = resolveTeamSize(params.get("size"));
  const live = params.get("live") === "1";

  // Session cookie, same shape the client-side TeamSizeSwitch writes.
  (await cookies()).set(TEAM_SIZE_COOKIE, String(size), {
    path: "/",
    sameSite: "lax",
  });

  const target = new URL("/budget/play", request.nextUrl.origin);
  target.searchParams.set("difficulty", "normal");
  if (lobby) target.searchParams.set("lobby", lobby);
  if (live) target.searchParams.set("live", "1");
  return NextResponse.redirect(target);
}
