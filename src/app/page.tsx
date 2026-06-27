import type { Metadata } from "next";
import { GridCalculator } from "@/features/grid-calculator/GridCalculator";

export const metadata: Metadata = {
  title: "Grid Calculator",
  description:
    "Free crypto grid trading calculator for Binance Futures. Arithmetic and geometric grids with long, short, and neutral strategies.",
};

export default function HomePage() {
  return <GridCalculator />;
}
