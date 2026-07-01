import type {
  GridCalculatorInput,
  GridCalculatorResult,
  GridCell,
  GridOrder,
} from "@/types/calculator";
import { gridInvestment, isBotStarted, totalWallet } from "@/types/calculator";
import { buildPriceLevels } from "@/lib/calculators/price-levels";
import { buildGridCells } from "@/lib/calculators/grid-cells";
import {
  computeUsdtMFuturesAllocation,
  countGridsAtStart,
  gridOpenPositionQty,
} from "@/lib/calculators/usdt-m-allocation";
import {
  calculateLiquidationLong,
  calculateLiquidationShort,
  calculateMargin,
  simulatePriceMove,
  snapshotAtStart,
} from "@/lib/calculators/simulation";

export { buildPriceLevels } from "@/lib/calculators/price-levels";
export { buildGridCells } from "@/lib/calculators/grid-cells";

export function calculateGrid(
  input: GridCalculatorInput,
): GridCalculatorResult | null {
  const {
    upperPrice,
    lowerPrice,
    currentPrice,
    startBotPrice,
    gridCount,
    feePercent,
    leverage,
    maintenanceMarginPercent,
    direction,
  } = input;

  const investment = gridInvestment(input);
  const wallet = totalWallet(input);
  const botStarted = isBotStarted(currentPrice, startBotPrice);

  if (
    gridCount < 2 ||
    input.margin <= 0 ||
    investment <= 0 ||
    upperPrice <= lowerPrice ||
    currentPrice < lowerPrice ||
    currentPrice > upperPrice ||
    startBotPrice < lowerPrice ||
    startBotPrice > upperPrice
  ) {
    return null;
  }

  const priceLevels = buildPriceLevels(input);
  const cells = buildGridCells(input);
  if (!cells) return null;

  const quotePerGrid = investment / gridCount;
  const spacing = priceLevels[1] - priceLevels[0];
  const midPrice = (upperPrice + lowerPrice) / 2;
  const spacingPercent = midPrice > 0 ? (spacing / midPrice) * 100 : 0;

  const orders = buildOrders(cells, startBotPrice, direction, botStarted);
  const gridCounts = countGridsAtStart(priceLevels, gridCount, startBotPrice);
  const buyOrdersBelow = gridCounts.buyBelow;
  const sellOrdersAbove = gridCounts.sellAbove;
  const futuresAlloc =
    direction === "long" || direction === "short"
      ? computeUsdtMFuturesAllocation(input, gridCounts)
      : null;

  const holdings = botStarted
    ? computeInitialHoldings(cells, startBotPrice, quotePerGrid, direction, futuresAlloc)
    : { initialCoin: 0, initialUsdt: investment };
  const { initialCoin, initialUsdt } = holdings;

  const projectedHoldings = computeInitialHoldings(
    cells,
    startBotPrice,
    quotePerGrid,
    direction,
    futuresAlloc,
  );
  const projectedCoin = projectedHoldings.initialCoin;
  const holdingsAtStart = {
    coin: projectedHoldings.initialCoin,
    usdt: projectedHoldings.initialUsdt,
  };

  const netPercents = cells.map((c) => c.netProfitPercent);
  const netProfits = cells.map((c) => c.netProfit);

  const profitPerGridMin = Math.min(...netProfits);
  const profitPerGridMax = Math.max(...netProfits);
  const profitPerGridAvg = netProfits.reduce((s, v) => s + v, 0) / netProfits.length;

  const margin = calculateMargin(projectedCoin, currentPrice, wallet, leverage);

  const openQty =
    direction === "long" || direction === "short"
      ? gridOpenPositionQty(input, priceLevels)
      : Math.abs(projectedCoin);
  const liqQty = openQty;
  const avgEntry = liqQty > 0 ? startBotPrice : 0;

  let liquidationPriceBase = 0;
  let liquidationPrice = 0;
  if (direction === "short" && liqQty > 0) {
    liquidationPriceBase = calculateLiquidationShort(
      avgEntry,
      liqQty,
      input.margin,
      maintenanceMarginPercent,
    );
    liquidationPrice = calculateLiquidationShort(
      avgEntry,
      liqQty,
      wallet,
      maintenanceMarginPercent,
    );
  } else if (liqQty > 0) {
    liquidationPriceBase = calculateLiquidationLong(
      avgEntry,
      liqQty,
      input.margin,
      maintenanceMarginPercent,
    );
    liquidationPrice = calculateLiquidationLong(
      avgEntry,
      liqQty,
      wallet,
      maintenanceMarginPercent,
    );
  }

  const distanceToLiqPercent =
    currentPrice > 0 && liquidationPrice > 0
      ? direction === "short"
        ? ((liquidationPrice - currentPrice) / currentPrice) * 100
        : ((currentPrice - liquidationPrice) / currentPrice) * 100
      : 0;

  const simulationAtStart = snapshotAtStart(input, cells);
  const simulationAtUpper = simulatePriceMove(input, cells, upperPrice);
  const simulationAtLower = simulatePriceMove(input, cells, lowerPrice);
  const simulationAtCurrent = simulatePriceMove(input, cells, currentPrice);

  return {
    priceLevels,
    cells,
    orders,
    spacing,
    spacingPercent,
    quotePerGrid,
    profitPerGridMin,
    profitPerGridMax,
    profitPerGridAvg,
    netProfitPercentMin: Math.min(...netPercents),
    netProfitPercentMax: Math.max(...netPercents),
    netProfitPercentAvg: netPercents.reduce((s, v) => s + v, 0) / netPercents.length,
    profitPerGridUsdtMin: profitPerGridMin,
    profitPerGridUsdtMax: profitPerGridMax,
    buyOrdersBelow,
    sellOrdersAbove,
    initialCoin,
    initialUsdt,
    initialCoinValue: initialCoin * currentPrice,
    totalPosition: initialUsdt + initialCoin * currentPrice,
    breakEvenSpacingPercent: feePercent * 2,
    margin,
    liquidationPrice,
    distanceToLiqPercent,
    simulationAtStart,
    simulationAtUpper,
    simulationAtLower,
    simulationAtCurrent,
    holdingsAtStart,
    startBotPrice,
    botStarted,
    totalWallet: wallet,
    liquidationPriceBase,
    investment,
    marginCollateral: input.margin,
  };
}

function buildOrders(
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  botStarted: boolean,
): GridOrder[] {
  if (!botStarted) {
    return cells.flatMap((cell) => {
      const items: GridOrder[] = [];
      if (direction !== "short" && cell.sellPrice > startPrice) {
        items.push({
          level: cell.level,
          type: "sell",
          price: cell.sellPrice,
          quantity: cell.quantity,
          quoteAmount: cell.sellPrice * cell.quantity,
          status: "pending",
        });
      }
      if (direction !== "short" && cell.buyPrice < startPrice) {
        items.push({
          level: cell.level,
          type: "buy",
          price: cell.buyPrice,
          quantity: cell.quantity,
          quoteAmount: cell.quotePerGrid,
          status: "pending",
        });
      }
      if (direction === "short" && cell.sellPrice > startPrice) {
        items.push({
          level: cell.level,
          type: "sell",
          price: cell.sellPrice,
          quantity: cell.quantity,
          quoteAmount: cell.sellPrice * cell.quantity,
          status: "pending",
        });
      }
      if (direction === "short" && cell.buyPrice < startPrice) {
        items.push({
          level: cell.level,
          type: "buy",
          price: cell.buyPrice,
          quantity: cell.quantity,
          quoteAmount: cell.quotePerGrid,
          status: "pending",
        });
      }
      return items;
    }).sort((a, b) => a.price - b.price);
  }

  const orders: GridOrder[] = [];

  if (direction === "neutral") {
    for (const cell of cells) {
      if (cell.sellPrice > startPrice) {
        orders.push({
          level: cell.level,
          type: "sell",
          price: cell.sellPrice,
          quantity: cell.quantity,
          quoteAmount: cell.sellPrice * cell.quantity,
          status: "placed",
        });
      }
      if (cell.buyPrice < startPrice) {
        orders.push({
          level: cell.level,
          type: "buy",
          price: cell.buyPrice,
          quantity: cell.quantity,
          quoteAmount: cell.quotePerGrid,
          status: "placed",
        });
      }
    }
    return orders.sort((a, b) => a.price - b.price);
  }

  if (direction === "long") {
    for (const cell of cells) {
      orders.push({
        level: cell.level,
        type: "buy",
        price: cell.buyPrice,
        quantity: cell.quantity,
        quoteAmount: cell.quotePerGrid,
        status: cell.buyPrice < startPrice ? "placed" : "pending",
      });
      orders.push({
        level: cell.level,
        type: "sell",
        price: cell.sellPrice,
        quantity: cell.quantity,
        quoteAmount: cell.sellPrice * cell.quantity,
        status: cell.sellPrice > startPrice ? "pending" : "placed",
      });
    }
    return orders.sort((a, b) => a.price - b.price);
  }

  for (const cell of cells) {
    orders.push({
      level: cell.level,
      type: "sell",
      price: cell.sellPrice,
      quantity: cell.quantity,
      quoteAmount: cell.sellPrice * cell.quantity,
      status: cell.sellPrice > startPrice ? "placed" : "pending",
    });
    orders.push({
      level: cell.level,
      type: "buy",
      price: cell.buyPrice,
      quantity: cell.quantity,
      quoteAmount: cell.quotePerGrid,
      status: cell.buyPrice < startPrice ? "pending" : "placed",
    });
  }
  return orders.sort((a, b) => a.price - b.price);
}

function computeInitialHoldings(
  cells: GridCell[],
  currentPrice: number,
  quotePerGrid: number,
  direction: GridCalculatorInput["direction"],
  futuresAlloc: ReturnType<typeof computeUsdtMFuturesAllocation> | null,
): { initialCoin: number; initialUsdt: number } {
  if (direction === "long" && futuresAlloc) {
    return {
      initialCoin: futuresAlloc.openQty,
      initialUsdt: futuresAlloc.freeMargin,
    };
  }

  if (direction === "short" && futuresAlloc) {
    const coin = cells
      .filter((c) => c.sellPrice > currentPrice)
      .reduce((sum, c) => sum + c.quantity, 0);
    return { initialCoin: -coin, initialUsdt: futuresAlloc.freeMargin };
  }

  const sellCells = cells.filter((c) => c.sellPrice > currentPrice);
  const buyCells = cells.filter((c) => c.buyPrice < currentPrice);

  const initialCoin = sellCells.length * (quotePerGrid / currentPrice);
  const initialUsdt = buyCells.length * quotePerGrid;

  return { initialCoin, initialUsdt };
}

export function formatProfitPerGridRange(
  min: number,
  max: number,
  gridType: GridCalculatorInput["gridType"],
): string {
  if (gridType === "geometric" || Math.abs(min - max) < 0.001) {
    return `${min.toFixed(2)}%`;
  }
  return `${min.toFixed(2)}% – ${max.toFixed(2)}%`;
}
