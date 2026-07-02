"use client";

import { useEffect } from "react";
import { cacheLobbyName } from "@/components/game/lobby-banner";

/** Renders nothing — caches the lobby's name for the draft banner, so heading
 *  into a draft from this page shows the lobby name on the very first frame. */
export function LobbyNameSeed({ code, name }: { code: string; name: string }) {
  useEffect(() => {
    cacheLobbyName(code, name);
  }, [code, name]);
  return null;
}
