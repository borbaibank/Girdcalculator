import type { GridCell, GridCalculatorInput, MarginInfo, PriceSimulation } from "@/types/calculator";
import { gridInvestment, totalWallet } from "@/types/calculator";
import {
  createWalletAtStart,
  type GridWalletState,
  type InventoryLot,
  walkPrice,
  walletEquity,
  walletUnrealizedPnl,
} from "@/lib/calculators/grid-engine";

export function calculateMargin(
  coin: number,
  price: number,
  walletBalance: number,
  leverage: number,
): MarginInfo {
  const positionNotional = Math.abs(coin) * price;
  const marginUsed = leverage > 0 ? positionNotional / leverage : positionNotional;
  const freeMargin = Math.max(0, walletBalance - marginUsed);
  const marginRatio = marginUsed > 0 ? (walletBalance / marginUsed) * 100 : 100;

  return { marginUsed, freeMargin, marginRatio, positionNotional };
}

export function calculateLiquidationLong(
  avgEntry: number,
  quantity: number,
  walletBalance: number,
  maintenanceMarginPercent: number,
): number {
  if (quantity <= 0 || avgEntry <= 0) return 0;

  const mmr = maintenanceMarginPercent / 100;
  const liq = (walletBalance - avgEntry * quantity) / (quantity * (mmr - 1));
  return Math.max(liq, 0);
}

export function calculateLiquidationShort(
  avgEntry: number,
  quantity: number,
  walletBalance: number,
  maintenanceMarginPercent: number,
): number {
  if (quantity <= 0 || avgEntry <= 0) return 0;

  const mmr = maintenanceMarginPercent / 100;
  const liq = (walletBalance + avgEntry * quantity) / (quantity * (1 + mmr));
  return liq;
}

/**
 * Pionex futures grid keeps ~10% of investment as dynamic/order buffer.
 * Estimated liquidation uses 90% of full leveraged notional at start price.
 */
export const PIONEX_GRID_DEPLOY_RATIO = 0.9;

export function pionexGridPositionQty(
  input: Pick<GridCalculatorInput, "margin" | "leverage" | "startBotPrice" | "direction" | "marketType" | "currentPrice">,
): number {
  const { startBotPrice, direction } = input;
  if (startBotPrice <= 0 || direction === "neutral") return 0;

  const investment = gridInvestment(input);
  if (investment <= 0) return 0;

  return (investment / startBotPrice) * PIONEX_GRID_DEPLOY_RATIO;
}

function weightedAvgCost(lots: InventoryLot[]): number {
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
  if (totalQty <= 0) return 0;
  return lots.reduce((s, l) => s + l.entryPrice * l.quantity, 0) / totalQty;
}

function walletToSimulation(
  wallet: GridWalletState,
  input: GridCalculatorInput,
  targetPrice: number,
): PriceSimulation {
  const { leverage, maintenanceMarginPercent, direction } = input;
  const walletBalance = totalWallet(input);
  const coinHeld = wallet.coin;
  const avgCost = weightedAvgCost(wallet.lots);
  const absQty = Math.abs(coinHeld);

  const unrealizedPnl = walletUnrealizedPnl(wallet, targetPrice, direction);
  const unrealizedAtCurrentPrice = walletUnrealizedPnl(wallet, input.currentPrice, direction);
  const totalEquity = walletEquity(wallet, targetPrice);
  const totalPnl = totalEquity - walletBalance;
  const liqWallet = walletBalance + wallet.realizedPnl;

  const margin = calculateMargin(coinHeld, targetPrice, liqWallet, leverage);

  let liquidationPrice = 0;
  if (direction === "short" && absQty > 0) {
    liquidationPrice = calculateLiquidationShort(
      avgCost,
      absQty,
      liqWallet,
      maintenanceMarginPercent,
    );
  } else if (absQty > 0) {
    liquidationPrice = calculateLiquidationLong(
      avgCost,
      absQty,
      liqWallet,
      maintenanceMarginPercent,
    );
  }

  const distanceToLiqPercent =
    targetPrice > 0 && liquidationPrice > 0
      ? direction === "short"
        ? ((liquidationPrice - targetPrice) / targetPrice) * 100
        : ((targetPrice - liquidationPrice) / targetPrice) * 100
      : 0;

  return {
    targetPrice,
    realizedPnl: wallet.realizedPnl,
    unrealizedPnl,
    unrealizedAtCurrentPrice,
    totalPnl,
    coinHeld,
    usdtBalance: wallet.usdt,
    totalEquity,
    avgCost,
    filledBuys: wallet.filledBuys,
    filledSells: wallet.filledSells,
    liquidationPrice,
    distanceToLiqPercent,
    margin,
  };
}

/** Snapshot of coin/USDT holdings when the bot starts at Start Bot Price. */
export function snapshotAtStart(
  input: GridCalculatorInput,
  cells: GridCell[],
): PriceSimulation {
  const wallet = createWalletAtStart(input, cells);
  return walletToSimulation(wallet, input, input.startBotPrice);
}

/** Simulate grid fills walking from Start Bot Price to targetPrice. */
export function simulatePriceMove(
  input: GridCalculatorInput,
  cells: GridCell[],
  toPrice: number,
): PriceSimulation {
  const { feePercent, direction, startBotPrice, upperPrice } = input;
  const feeRate = feePercent / 100;
  const wallet = createWalletAtStart(input, cells);

  walkPrice(wallet, cells, startBotPrice, toPrice, direction, feeRate, upperPrice);

  return walletToSimulation(wallet, input, toPrice);
}
