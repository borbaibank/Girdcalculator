import type { GridCalculatorInput, GridCell } from "@/types/calculator";
import { gridInvestment, totalWallet } from "@/types/calculator";

export function countGridsAtStart(
  priceLevels: number[],
  gridCount: number,
  startPrice: number,
): { buyBelow: number; sellAbove: number } {
  let buyBelow = 0;
  let sellAbove = 0;
  for (let i = 0; i < gridCount; i++) {
    if (priceLevels[i] < startPrice) buyBelow++;
    if (priceLevels[i + 1] > startPrice) sellAbove++;
  }
  return { buyBelow, sellAbove };
}

export function countGridsFromCells(
  cells: GridCell[],
  startPrice: number,
): { buyBelow: number; sellAbove: number } {
  return {
    buyBelow: cells.filter((c) => c.buyPrice < startPrice).length,
    sellAbove: cells.filter((c) => c.sellPrice > startPrice).length,
  };
}

export interface UsdtMFuturesAllocation {
  buyBelow: number;
  sellAbove: number;
  quotePerGrid: number;
  openQty: number;
  openMarginUsed: number;
  buyReserveMargin: number;
  freeMargin: number;
}

/** USDT-M futures grid sizing from buy-below / sell-above counts at start. */
export function computeUsdtMFuturesAllocation(
  input: Pick<
    GridCalculatorInput,
    "margin" | "addedMargin" | "leverage" | "gridCount" | "startBotPrice" | "direction" | "currentPrice" | "marketType"
  >,
  counts: { buyBelow: number; sellAbove: number },
): UsdtMFuturesAllocation {
  const { startBotPrice, direction, gridCount } = input;
  const investment = gridInvestment(input);
  const quotePerGrid = gridCount > 0 ? investment / gridCount : 0;
  const lev = input.leverage > 0 ? input.leverage : 1;
  const walletMargin = totalWallet(input);
  const { buyBelow, sellAbove } = counts;

  const openQty =
    direction === "long" || direction === "short"
      ? startBotPrice > 0
        ? (sellAbove * quotePerGrid) / startBotPrice
        : 0
      : 0;

  const openMarginUsed = (openQty * startBotPrice) / lev;
  const buyReserveMargin = buyBelow * (quotePerGrid / lev);
  const freeMargin = Math.max(0, walletMargin - openMarginUsed);

  return {
    buyBelow,
    sellAbove,
    quotePerGrid,
    openQty,
    openMarginUsed,
    buyReserveMargin,
    freeMargin,
  };
}

export function gridOpenPositionQty(
  input: GridCalculatorInput,
  priceLevels: number[],
): number {
  if (input.direction === "neutral" || input.startBotPrice <= 0) return 0;
  const counts = countGridsAtStart(priceLevels, input.gridCount, input.startBotPrice);
  return computeUsdtMFuturesAllocation(input, counts).openQty;
}
