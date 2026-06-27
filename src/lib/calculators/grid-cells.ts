import { buildPriceLevels } from "@/lib/calculators/price-levels";
import type { GridCalculatorInput, GridCell } from "@/types/calculator";
import { gridInvestment } from "@/types/calculator";

function cellZone(
  buyPrice: number,
  sellPrice: number,
  startPrice: number,
): GridCell["zone"] {
  if (startPrice >= sellPrice) return "below";
  if (startPrice <= buyPrice) return "above";
  return "current";
}

/** Build grid cells for the calculator. */
export function buildGridCells(input: GridCalculatorInput): GridCell[] | null {
  const {
    upperPrice,
    lowerPrice,
    startBotPrice,
    gridCount,
    feePercent,
    direction,
  } = input;

  const investment = gridInvestment(input);
  if (
    gridCount < 2 ||
    investment <= 0 ||
    upperPrice <= lowerPrice ||
    startBotPrice < lowerPrice ||
    startBotPrice > upperPrice
  ) {
    return null;
  }

  const priceLevels = buildPriceLevels(input);
  const feeRate = feePercent / 100;
  const quotePerGrid = investment / gridCount;
  const cells: GridCell[] = [];

  for (let i = 0; i < gridCount; i++) {
    const buyPrice = priceLevels[i];
    const sellPrice = priceLevels[i + 1];
    const quantity = quotePerGrid / buyPrice;

    const grossProfit =
      direction === "short"
        ? quantity * (buyPrice - sellPrice)
        : quantity * (sellPrice - buyPrice);

    const buyFee = buyPrice * quantity * feeRate;
    const sellFee = sellPrice * quantity * feeRate;
    const fee = buyFee + sellFee;
    const netProfit = grossProfit - fee;
    const profitPercent = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;
    const netProfitPercent = profitPercent - feePercent * 2;

    cells.push({
      level: i + 1,
      buyPrice,
      sellPrice,
      quotePerGrid,
      quantity,
      grossProfit,
      fee,
      netProfit,
      profitPercent: direction === "short" ? -profitPercent : profitPercent,
      netProfitPercent: direction === "short" ? -netProfitPercent : netProfitPercent,
      zone: cellZone(buyPrice, sellPrice, startBotPrice),
    });
  }

  return cells;
}
