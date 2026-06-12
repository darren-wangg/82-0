import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import { AppMotion } from "@/components/app-motion";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  "Spin for a random NBA franchise and era, draft an 8-man all-time roster, and see if your team can go 82-0.";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppMotion>{children}</AppMotion>
        <Analytics />
      </body>
    </html>
  );
}
