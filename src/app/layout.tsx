import type { Metadata } from "next";
import { Anton, Geist_Mono, Press_Start_2P, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AppMotion } from "@/components/app-motion";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Body face — named --font-sans so the Tailwind font-sans utility (mapped
 *  to var(--font-sans) in globals.css) picks it up. */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Big sporty display face for records, reels, and headers. */
const anton = Anton({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

/** NBA Jam arcade pixel face — accent labels, section headers, callouts.
 *  Same face the share cards render with (satori loads its own copy). */
const pressStart = Press_Start_2P({
  variable: "--font-arcade",
  weight: "400",
  subsets: ["latin"],
});

const SITE_TITLE = "Ultimate Draft — Chase the Perfect 82-0 Season";
const SITE_DESCRIPTION =
  "Spin for a random NBA team and era, draft an 8-man all-time roster, and see if your team can go 82-0.";

// The og/twitter images come from the opengraph-image.jpg file convention.
export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Ultimate Draft",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie-driven locale (no URL prefix); NextIntlClientProvider inherits the
  // locale + messages from the request config (src/i18n/request.ts).
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      // The language switcher flips `lang` (and all strings) client-side via a
      // cookie + router.refresh(); the initial document was hydrated with the
      // previous locale. suppressHydrationWarning covers only <html>'s own
      // attributes (same pattern as next-themes) — real mismatches in the tree
      // still surface. A fresh request renders the cookie's locale directly.
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${geistMono.variable} ${anton.variable} ${pressStart.variable} h-full antialiased`}
    >
      {/* Browser extensions (e.g. Grammarly) inject attributes on <body> after
          SSR; suppress the resulting one-level hydration warning. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>
          <AppMotion>{children}</AppMotion>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
