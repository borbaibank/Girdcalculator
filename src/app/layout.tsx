import { Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "GridCalc — Grid Trading Calculator",
  description:
    "Free crypto grid trading calculator. Arithmetic and geometric grids with long, short, and neutral strategies.",
  keywords: ["grid calculator", "grid trading", "binance futures", "crypto calculator"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={jakarta.variable}>
      <body className={`${jakarta.className} flex min-h-screen flex-col`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
