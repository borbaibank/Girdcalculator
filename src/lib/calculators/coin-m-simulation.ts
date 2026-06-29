import type { GridCell, GridCalculatorInput, MarginInfo, PriceSimulation } from "@/types/calculator";
import { totalWallet } from "@/types/calculator";
import type { CoinMGridMeta } from "@/lib/calculators/coin-m-grid-cells";
import {
  calculateCoinMLiquidationLong,
  calculateCoinMLiquidationShort,
  marginForBtcPosition,
} from "@/lib/calculators/coin-m-formulas";
import {
  coinMWalletEquity,
  coinMWalletUnrealizedPnl,
  createCoinMWalletAtStart,
  type CoinMWalletState,
  walkCoinMPrice,
} from "@/lib/calculators/coin-m-engine";

export function calculateCoinMMargin(
  btcHeld: number,
  price: number,
  walletBalanceCoin: number,
  leverage: number,
): MarginInfo {
  const positionNotional = Math.abs(btcHeld) * price;
  const marginUsedCoin = marginForBtcPosition(Math.abs(btcHeld), leverage);
  const freeMargin = Math.max(0, walletBalanceCoin - marginUsedCoin);
  const marginRatio = marginUsedCoin > 0 ? (walletBalanceCoin / marginUsedCoin) * 100 : 100;

  return { marginUsed: marginUsedCoin, freeMargin, marginRatio, positionNotional };
}

function weightedAvgEntry(lots: CoinMWalletState["lots"]): number {
  const total = lots.reduce((s, l) => s + l.btcSize, 0);
  if (total <= 0) return 0;
  return lots.reduce((s, l) => s + l.entryPrice * l.btcSize, 0) / total;
}

function walletToCoinMSimulation(
  wallet: CoinMWalletState,
  input: GridCalculatorInput,
  targetPrice: number,
): PriceSimulation {
  const { leverage, maintenanceMarginPercent, direction } = input;
  const walletMargin = totalWallet(input);
  const absBtc = Math.abs(wallet.btcHeld);
  const avgCost = weightedAvgEntry(wallet.lots);

  const unrealizedPnl = coinMWalletUnrealizedPnl(wallet, targetPrice, input);
  const unrealizedAtCurrentPrice = coinMWalletUnrealizedPnl(wallet, input.currentPrice, input);
  const totalEquity = coinMWalletEquity(wallet, targetPrice, input);
  const totalPnl = totalEquity - walletMargin;
  const liqWallet = walletMargin + wallet.realizedPnl;

  const margin = calculateCoinMMargin(wallet.btcHeld, targetPrice, liqWallet, leverage);

  let liquidationPrice = 0;
  if (direction === "short" && absBtc > 0 && avgCost > 0) {
    liquidationPrice = calculateCoinMLiquidationShort(
      avgCost,
      absBtc,
      liqWallet,
      maintenanceMarginPercent,
      Math.abs(wallet.btcHeld) * targetPrice,
    );
  } else if (absBtc > 0 && avgCost > 0) {
    liquidationPrice = calculateCoinMLiquidationLong(
      avgCost,
      absBtc,
      liqWallet,
      maintenanceMarginPercent,
      Math.abs(wallet.btcHeld) * targetPrice,
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
    coinHeld: wallet.btcHeld,
    usdtBalance: wallet.coinBalance,
    totalEquity,
    avgCost,
    filledBuys: wallet.filledBuys,
    filledSells: wallet.filledSells,
    liquidationPrice,
    distanceToLiqPercent,
    margin,
  };
}

export function snapshotCoinMAtStart(
  input: GridCalculatorInput,
  cells: GridCell[],
  meta: CoinMGridMeta,
): PriceSimulation {
  const wallet = createCoinMWalletAtStart(input, cells, meta);
  return walletToCoinMSimulation(wallet, input, input.startBotPrice);
}

export function simulateCoinMPriceMove(
  input: GridCalculatorInput,
  cells: GridCell[],
  toPrice: number,
  meta: CoinMGridMeta,
): PriceSimulation {
  const feeRate = input.feePercent / 100;
  const wallet = createCoinMWalletAtStart(input, cells, meta);

  walkCoinMPrice(
    wallet,
    cells,
    input.startBotPrice,
    toPrice,
    input.direction,
    feeRate,
    input.upperPrice,
    input.leverage,
  );

  return walletToCoinMSimulation(wallet, input, toPrice);
}
