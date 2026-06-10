"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LobbyResponse } from "@/lib/contracts";

export function CreateLobbyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const lobby: LobbyResponse = await res.json();
      router.push(`/l/${lobby.code}`);
    } catch {
      setError("Couldn't create the lobby right now — try again in a minute.");
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
        placeholder="Lobby name (e.g. The Group Chat)"
        aria-label="Lobby name"
        className="h-11 rounded-xl"
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-base font-bold"
        disabled={pending || name.trim().length === 0}
      >
        {pending ? "Creating…" : "Create lobby"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
