import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SocialNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-muted-foreground">
        0–82
      </p>
      <div>
        <h1 className="text-lg font-bold">Nothing here</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That link doesn&apos;t match any team, matchup, or lobby.
        </p>
      </div>
      <Link href="/play" className={cn(buttonVariants())}>
        Draft your own team
      </Link>
    </div>
  );
}
