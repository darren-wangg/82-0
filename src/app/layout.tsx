import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { AppMotion } from "@/components/app-motion";
import "./globals.css";

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

const SITE_TITLE = "82-0 — Draft the Perfect Season";
const SITE_DESCRIPTION =
  "Spin for a random NBA franchise and era, draft an 8-man all-time roster, and see if your team can go 82-0.";

// The og/twitter images come from the opengraph-image.jpg file convention.
export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "82-0",
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
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppMotion>{children}</AppMotion>
      </body>
    </html>
  );
}
