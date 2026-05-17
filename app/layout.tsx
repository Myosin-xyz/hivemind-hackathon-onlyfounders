import type { Metadata } from "next";
import { Syne, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { HivemindLockup } from "./_brand/HivemindLockup";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Only Founders: founder-led content that sounds like the founder",
  description:
    "Hivemind-grounded pipeline. One founder, one signal, one angle, one pillar plus four channel variations. Voice-locked, not generic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-of-black text-white">
        <div className="flex-1">{children}</div>
        {/* Mandatory: Powered by Hivemind appears on every page (brand §4). */}
        {/* Pages with their own bottom bar render this inline; this is the safety net. */}
        <footer className="border-t border-white/5 px-6 py-2.5 flex items-center justify-end">
          <HivemindLockup variant="dark" />
        </footer>
      </body>
    </html>
  );
}
