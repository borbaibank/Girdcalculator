import { buildPriceLevels } from "@/lib/calculators/price-levels";
import {
  btcFromUsdNotional,
  contractUsdForSymbol,
  contractsFromUsd,
  countOrderSlots,
  deployRatios,
  inverseLongCycleProfitBtc,
  inverseShortCycleProfitBtc,
  inverseTradeFeeBtc,
  marginForBtcPosition,
  quotePerGridUsd,
} from "@/lib/calculators/coin-m-formulas";
import type { GridCalculatorInput, GridCell } from "@/types/calculator";

function cellZone(
  buyPrice: number,
  sellPrice: number,
  startPrice: number,
): GridCell["zone"] {
  if (startPrice >= sellPrice) return "below";
  if (startPrice <= buyPrice) return "above";
  return "current";
}

export interface CoinMGridMeta {
  quotePerGridUsd: number;
  contractsPerGrid: number;
  orderSlots: number;
  deployRatio: number;
  reserveRatio: number;
  openValueBtc: number;
  buyBelow: number;
  sellAbove: number;
}

export function buildCoinMGridMeta(
  input: GridCalculatorInput,
  priceLevels: number[],
): CoinMGridMeta {
  const { startBotPrice, direction, coinSymbol = "BTC" } = input;
  const markPrice = input.currentPrice > 0 ? input.currentPrice : startBotPrice;
  const { deployRatio, reserveRatio } = deployRatios(direction);

  let buyBelow = 0;
  let sellAbove = 0;
  for (let i = 0; i < input.gridCount; i++) {
    if (priceLevels[i] < startBotPrice) buyBelow++;
    if (priceLevels[i + 1] > startBotPrice) sellAbove++;
  }

  const orderSlots = countOrderSlots(buyBelow, sellAbove, direction, input.gridCount);
  const usdPerGrid = quotePerGridUsd(
    input.margin,
    markPrice,
    input.leverage,
    reserveRatio,
    orderSlots,
  );
  const contractUsd = contractUsdForSymbol(coinSymbol);
  const contracts = contractsFromUsd(usdPerGrid, contractUsd);
  const lev = input.leverage > 0 ? input.leverage : 1;
  const openValueBtc =
    direction === "long" || direction === "short"
      ? input.margin * lev * deployRatio
      : sellAbove * btcFromUsdNotional(usdPerGrid, startBotPrice);

  return {
    quotePerGridUsd: usdPerGrid,
    contractsPerGrid: contracts,
    orderSlots,
    deployRatio,
    reserveRatio,
    openValueBtc,
    buyBelow,
    sellAbove,
  };
}

/** Build grid cells for Coin-M — USD notional per grid (Binance model). */
export function buildCoinMGridCells(
  input: GridCalculatorInput,
): { cells: GridCell[]; meta: CoinMGridMeta } | null {
  const { upperPrice, lowerPrice, startBotPrice, gridCount, feePercent, direction } = input;

  if (
    gridCount < 2 ||
    input.margin <= 0 ||
    upperPrice <= lowerPrice ||
    startBotPrice < lowerPrice ||
    startBotPrice > upperPrice
  ) {
    return null;
  }

  const priceLevels = buildPriceLevels(input);
  const meta = buildCoinMGridMeta(input, priceLevels);
  const { quotePerGridUsd: usdPerGrid } = meta;

  if (usdPerGrid <= 0) return null;

  const feeRate = feePercent / 100;
  const lev = input.leverage > 0 ? input.leverage : 1;
  const cells: GridCell[] = [];

  for (let i = 0; i < gridCount; i++) {
    const buyPrice = priceLevels[i];
    const sellPrice = priceLevels[i + 1];
    const btcPerOrder = btcFromUsdNotional(usdPerGrid, buyPrice);

    const grossProfit =
      direction === "short"
        ? inverseShortCycleProfitBtc(btcPerOrder, buyPrice, sellPrice)
        : inverseLongCycleProfitBtc(btcPerOrder, buyPrice, sellPrice);

    const fee = inverseTradeFeeBtc(btcPerOrder, feeRate) * 2;
    const netProfit = grossProfit - fee;
    const profitPercent = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;
    const marginPerGridCoin = marginForBtcPosition(btcPerOrder, lev);
    const netProfitPercent =
      marginPerGridCoin > 0 ? (netProfit / marginPerGridCoin) * 100 : 0;

    cells.push({
      level: i + 1,
      buyPrice,
      sellPrice,
      quotePerGrid: usdPerGrid,
      quantity: btcPerOrder,
      grossProfit,
      fee,
      netProfit,
      profitPercent: direction === "short" ? -profitPercent : profitPercent,
      netProfitPercent: direction === "short" ? -netProfitPercent : netProfitPercent,
      zone: cellZone(buyPrice, sellPrice, startBotPrice),
    });
  }

  return { cells, meta };
}
