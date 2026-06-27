import { Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = getSiteUrl();
const title = "GridCalc — Grid Trading Calculator";
const description =
  "Free crypto grid trading calculator. Simulate profit per grid, margin, liquidation, and buy/sell orders for arithmetic and geometric grids with long, short, and neutral strategies.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | GridCalc",
  },
  description,
  keywords: [
    "grid calculator",
    "grid trading",
    "grid bot",
    "binance futures",
    "crypto calculator",
    "futures grid",
  ],
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "GridCalc",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className={`${jakarta.className} flex min-h-screen flex-col`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
