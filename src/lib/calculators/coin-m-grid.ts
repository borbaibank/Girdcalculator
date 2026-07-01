import type {
  GridCalculatorInput,
  GridCalculatorResult,
  GridCell,
  GridOrder,
} from "@/types/calculator";
import { gridInvestment, isBotStarted, totalWallet } from "@/types/calculator";
import {
  buildCoinMWarnings,
  calculateCoinMLiquidationLong,
  calculateCoinMLiquidationShort,
  inverseLongUnrealizedBtc,
  inverseShortUnrealizedBtc,
} from "@/lib/calculators/coin-m-formulas";
import { buildPriceLevels } from "@/lib/calculators/price-levels";
import { buildCoinMGridCells } from "@/lib/calculators/coin-m-grid-cells";
import {
  calculateCoinMMargin,
  simulateCoinMPriceMove,
  snapshotCoinMAtStart,
} from "@/lib/calculators/coin-m-simulation";

function buildOrders(
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  botStarted: boolean,
): GridOrder[] {
  if (!botStarted) {
    return cells
      .flatMap((cell) => {
        const items: GridOrder[] = [];
        if (direction !== "short" && cell.sellPrice > startPrice) {
          items.push({
            level: cell.level,
            type: "sell",
            price: cell.sellPrice,
            quantity: cell.quantity,
            quoteAmount: cell.quotePerGrid,
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
            quoteAmount: cell.quotePerGrid,
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
      })
      .sort((a, b) => a.price - b.price);
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
          quoteAmount: cell.quotePerGrid,
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
        quoteAmount: cell.quotePerGrid,
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
      quoteAmount: cell.quotePerGrid,
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

export function calculateCoinMGrid(
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
    coinSymbol = "BTC",
  } = input;

  const coinInput: GridCalculatorInput = { ...input, marketType: "coin-m" };
  const investment = gridInvestment(coinInput);
  const wallet = totalWallet(coinInput);
  const botStarted = isBotStarted(currentPrice, startBotPrice);

  if (
    gridCount < 2 ||
    input.margin <= 0 ||
    upperPrice <= lowerPrice ||
    currentPrice < lowerPrice ||
    currentPrice > upperPrice ||
    startBotPrice < lowerPrice ||
    startBotPrice > upperPrice
  ) {
    return null;
  }

  const built = buildCoinMGridCells(coinInput);
  if (!built) return null;

  const { cells, meta } = built;
  const priceLevels = buildPriceLevels(coinInput);
  const quotePerGrid = meta.quotePerGridUsd;
  const spacing = priceLevels[1] - priceLevels[0];
  const midPrice = (upperPrice + lowerPrice) / 2;
  const spacingPercent = midPrice > 0 ? (spacing / midPrice) * 100 : 0;

  const orders = buildOrders(cells, startBotPrice, direction, botStarted);
  const buyOrdersBelow = meta.buyBelow;
  const sellOrdersAbove = meta.sellAbove;

  const projectedBtc =
    direction === "long"
      ? meta.openValueBtc
      : direction === "short"
        ? -meta.openValueBtc
        : meta.sellAbove * cells[0].quantity;

  const holdingsAtStart = {
    coin: projectedBtc,
    usdt: input.margin * meta.reserveRatio,
  };

  const { initialCoin, initialUsdt } = botStarted
    ? { initialCoin: projectedBtc, initialUsdt: input.margin * meta.reserveRatio }
    : { initialCoin: 0, initialUsdt: input.margin };

  const netPercents = cells.map((c) => c.netProfitPercent);
  const netProfits = cells.map((c) => c.netProfit);
  const gridProfitPercents = cells.map((c) => c.profitPercent - feePercent * 2);

  const profitPerGridMin = Math.min(...netProfits);
  const profitPerGridMax = Math.max(...netProfits);
  const profitPerGridAvg = netProfits.reduce((s, v) => s + v, 0) / netProfits.length;

  const absBtc = Math.abs(projectedBtc);
  const notionalUsd = absBtc * currentPrice;
  const margin = calculateCoinMMargin(projectedBtc, currentPrice, wallet, leverage);
  const avgEntry = startBotPrice;

  let liquidationPriceBase = 0;
  let liquidationPrice = 0;
  if (direction === "short" && absBtc > 0) {
    liquidationPriceBase = calculateCoinMLiquidationShort(
      avgEntry,
      absBtc,
      input.margin,
      maintenanceMarginPercent,
      notionalUsd,
    );
    liquidationPrice = calculateCoinMLiquidationShort(
      avgEntry,
      absBtc,
      wallet,
      maintenanceMarginPercent,
      notionalUsd,
    );
  } else if (absBtc > 0) {
    liquidationPriceBase = calculateCoinMLiquidationLong(
      avgEntry,
      absBtc,
      input.margin,
      maintenanceMarginPercent,
      notionalUsd,
    );
    liquidationPrice = calculateCoinMLiquidationLong(
      avgEntry,
      absBtc,
      wallet,
      maintenanceMarginPercent,
      notionalUsd,
    );
  }

  const distanceToLiqPercent =
    currentPrice > 0 && liquidationPrice > 0
      ? direction === "short"
        ? ((liquidationPrice - currentPrice) / currentPrice) * 100
        : ((currentPrice - liquidationPrice) / currentPrice) * 100
      : 0;

  const simulationAtStart = snapshotCoinMAtStart(coinInput, cells, meta);
  const simulationAtUpper = simulateCoinMPriceMove(coinInput, cells, upperPrice, meta);
  const simulationAtLower = simulateCoinMPriceMove(coinInput, cells, lowerPrice, meta);
  const simulationAtCurrent = simulateCoinMPriceMove(coinInput, cells, currentPrice, meta);

  const openPositionUnrealizedAtCurrent =
    direction === "long"
      ? inverseLongUnrealizedBtc(meta.openValueBtc, startBotPrice, currentPrice)
      : direction === "short"
        ? inverseShortUnrealizedBtc(meta.openValueBtc, startBotPrice, currentPrice)
        : 0;

  const warnings = buildCoinMWarnings(input.margin, leverage, meta.openValueBtc, coinSymbol);

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
    gridProfitPercentMin: Math.min(...gridProfitPercents),
    gridProfitPercentMax: Math.max(...gridProfitPercents),
    profitPerGridUsdtMin: profitPerGridMin * currentPrice,
    profitPerGridUsdtMax: profitPerGridMax * currentPrice,
    buyOrdersBelow,
    sellOrdersAbove,
    initialCoin,
    initialUsdt,
    initialCoinValue: absBtc * currentPrice,
    totalPosition: absBtc * currentPrice,
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
    warnings,
    coinMeta: meta,
    openPositionUnrealizedAtCurrent,
  };
}

export function formatCoinMProfitPerGridRange(
  minPct: number,
  maxPct: number,
  gridType: GridCalculatorInput["gridType"],
): string {
  if (gridType === "geometric" || Math.abs(minPct - maxPct) < 0.001) {
    return `${minPct.toFixed(2)}%`;
  }
  return `${minPct.toFixed(2)}% – ${maxPct.toFixed(2)}%`;
}
