"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { NINE_CATS, type PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { CAT_LABELS, formatCatValue, isEstimated } from "./format";
import { PlayerHeadshot } from "./player-headshot";

const PICK_ANIMATION_MS = 650;

function QuickStat({
  label,
  value,
  est,
}: {
  label: string;
  value: string;
  est: boolean;
}) {
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-mono font-semibold text-foreground tabular-nums">
        {value}
      </span>{" "}
      {label}
      {est && <span className="text-[9px] text-muted-foreground/70"> est.</span>}
    </span>
  );
}

function NineCatGrid({ player }: { player: PlayerStatLine }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg bg-muted/40 p-3">
      {NINE_CATS.map((cat) => (
        <div key={cat} className="flex flex-col">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
            {CAT_LABELS[cat]}
            {isEstimated(player, cat) && (
              <span className="ml-0.5 text-[9px] text-muted-foreground/70">
                est.
              </span>
            )}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatCatValue(cat, player.stats[cat])}
          </span>
        </div>
      ))}
    </div>
  );
}

function PoolRow({
  player,
  expanded,
  picked,
  onToggle,
  onDraft,
}: {
  player: PlayerStatLine;
  expanded: boolean;
  picked: boolean;
  onToggle: () => void;
  onDraft: () => void;
}) {
  return (
    <motion.li
      layout="position"
      animate={picked ? { scale: [1, 1.03, 1] } : undefined}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-card/70 transition-colors",
        expanded && "border-primary/40 bg-card",
        picked && "border-primary"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[64px] w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <PlayerHeadshot player={player} className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{player.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {player.nickname ? `“${player.nickname}” · ` : ""}
            {player.peakSeason}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <QuickStat
              label="PPG"
              value={player.stats.pts.toFixed(1)}
              est={isEstimated(player, "pts")}
            />
            <QuickStat
              label="RPG"
              value={player.stats.reb.toFixed(1)}
              est={isEstimated(player, "reb")}
            />
            <QuickStat
              label="APG"
              value={player.stats.ast.toFixed(1)}
              est={isEstimated(player, "ast")}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex gap-1">
            <Badge className="font-mono">{player.position}</Badge>
            {player.altPositions.map((p) => (
              <Badge key={p} variant="outline" className="font-mono">
                {p}
              </Badge>
            ))}
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-3 pb-3">
              <NineCatGrid player={player} />
              <Button
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={picked}
                onClick={onDraft}
              >
                {picked ? (
                  <>
                    <Check className="size-5" /> Drafted!
                  </>
                ) : (
                  `Draft ${player.name.split(" ").slice(-1)[0]}`
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* confirm-pick flash */}
      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/15 backdrop-blur-[1px]"
          >
            <motion.div
              initial={{ scale: 0.3 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-7" strokeWidth={3} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/**
 * Bottom drawer listing the spun franchise×decade pool, sorted by scoring.
 * Tapping a row expands the full 9-cat line; "Draft" plays a confirm
 * animation, then commits the pick via onPick.
 */
export function PoolDrawer({
  open,
  onOpenChange,
  title,
  description,
  pool,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pool: PlayerStatLine[];
  onPick: (playerId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const sorted = [...pool].sort((a, b) => b.stats.pts - a.stats.pts);

  const draft = (id: string) => {
    if (pickedId) return; // a pick is already animating
    setPickedId(id);
    window.setTimeout(() => {
      onPick(id);
      onOpenChange(false);
      setPickedId(null);
      setExpandedId(null);
    }, PICK_ANIMATION_MS);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next && pickedId) return; // don't dismiss mid-confirm
        onOpenChange(next);
        if (!next) setExpandedId(null);
      }}
    >
      <DrawerContent className="dark border-border bg-background text-foreground">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-bold">{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sorted.map((p) => (
            <PoolRow
              key={p.id}
              player={p}
              expanded={expandedId === p.id}
              picked={pickedId === p.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === p.id ? null : p.id))
              }
              onDraft={() => draft(p.id)}
            />
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
