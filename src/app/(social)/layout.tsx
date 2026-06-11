/**
 * Shared layout for the social surfaces (/t, /m, /l): dark, sporty,
 * mobile-first single column capped at max-w-md.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Ultimate Draft", template: "%s — Ultimate Draft" },
  description:
    "Draft an 8-player all-time NBA roster and see how close to 82-0 it gets.",
};

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex w-full flex-1 flex-col items-center bg-background font-sans text-foreground">
      <div className="flex w-full max-w-md flex-1 flex-col px-4 pb-12 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/" className="font-display text-sm tracking-wide uppercase">
            <span className="text-primary">Ultimate</span>{" "}
            <span className="text-foreground">Draft</span>
          </Link>
          <Link
            href="/play"
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
