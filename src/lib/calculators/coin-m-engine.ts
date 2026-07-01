import type { CoinMGridMeta } from "@/lib/calculators/coin-m-grid-cells";
import {
  btcFromUsdNotional,
  inverseLongCycleProfitBtc,
  inverseLongUnrealizedBtc,
  inverseShortUnrealizedBtc,
  inverseTradeFeeBtc,
  marginForBtcPosition,
} from "@/lib/calculators/coin-m-formulas";
import type { GridCalculatorInput, GridCell } from "@/types/calculator";
import { totalWallet } from "@/types/calculator";

export interface InventoryLot {
  btcSize: number;
  entryPrice: number;
  gridLevel: number;
}

export interface CoinMWalletState {
  walletMargin: number;
  coinBalance: number;
  reservedCoin: number;
  btcHeld: number;
  realizedPnl: number;
  lots: InventoryLot[];
  filledBuys: number;
  filledSells: number;
}

function totalBtc(lots: InventoryLot[]): number {
  return lots.reduce((s, l) => s + l.btcSize, 0);
}

function unrealizedFromLots(
  lots: InventoryLot[],
  markPrice: number,
  direction: GridCalculatorInput["direction"],
): number {
  if (direction === "short") {
    return lots.reduce(
      (s, l) => s + inverseShortUnrealizedBtc(l.btcSize, l.entryPrice, markPrice),
      0,
    );
  }
  return lots.reduce(
    (s, l) => s + inverseLongUnrealizedBtc(l.btcSize, l.entryPrice, markPrice),
    0,
  );
}

function syncBtcHeld(wallet: CoinMWalletState, direction: GridCalculatorInput["direction"]): void {
  const total = totalBtc(wallet.lots);
  wallet.btcHeld = direction === "short" ? -total : total;
}

function allocateBalance(
  walletMargin: number,
  openBtc: number,
  pendingBuyCount: number,
  btcPerOrder: number,
  leverage: number,
): { coinBalance: number; reservedCoin: number } {
  const openMargin = marginForBtcPosition(openBtc, leverage);
  const reservedCoin = pendingBuyCount * marginForBtcPosition(btcPerOrder, leverage);
  const coinBalance = Math.max(0, walletMargin - openMargin - reservedCoin);
  return { coinBalance, reservedCoin };
}

export function initCoinMWallet(
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  input: GridCalculatorInput,
  meta: CoinMGridMeta,
): CoinMWalletState {
  const btcPerOrder = btcFromUsdNotional(meta.quotePerGridUsd, startPrice);
  const lev = input.leverage > 0 ? input.leverage : 1;
  const walletMargin = totalWallet(input);
  const lots: InventoryLot[] = [];

  if (direction === "long") {
    const feeRate = input.feePercent / 100;
    const openFee = inverseTradeFeeBtc(meta.openValueBtc, feeRate);
    lots.push({ btcSize: meta.openValueBtc, entryPrice: startPrice, gridLevel: 0 });
    const openMargin = marginForBtcPosition(meta.openValueBtc, lev);
    const reservedCoin = input.margin * meta.reserveRatio;
    return {
      walletMargin,
      coinBalance: Math.max(0, walletMargin - openMargin - reservedCoin - openFee),
      reservedCoin,
      btcHeld: meta.openValueBtc,
      realizedPnl: 0,
      lots,
      filledBuys: 0,
      filledSells: 0,
    };
  }

  if (direction === "short") {
    const feeRate = input.feePercent / 100;
    const openBtc = meta.openValueBtc;
    const openFee = inverseTradeFeeBtc(openBtc, feeRate);
    lots.push({ btcSize: openBtc, entryPrice: startPrice, gridLevel: 0 });
    const openMargin = marginForBtcPosition(openBtc, lev);
    const reservedCoin = input.margin * meta.reserveRatio;
    return {
      walletMargin,
      coinBalance: Math.max(0, walletMargin - openMargin - reservedCoin - openFee),
      reservedCoin,
      btcHeld: -openBtc,
      realizedPnl: 0,
      lots,
      filledBuys: 0,
      filledSells: 0,
    };
  }

  const sellCells = cells.filter((c) => c.sellPrice > startPrice);
  const buyCells = cells.filter((c) => c.buyPrice < startPrice);

  for (const cell of sellCells) {
    lots.push({ btcSize: cell.quantity, entryPrice: startPrice, gridLevel: cell.level });
  }

  const openBtc = totalBtc(lots);
  const { coinBalance, reservedCoin } = allocateBalance(
    walletMargin,
    openBtc,
    buyCells.length,
    btcPerOrder,
    lev,
  );

  return {
    walletMargin,
    coinBalance,
    reservedCoin,
    btcHeld: openBtc,
    realizedPnl: 0,
    lots,
    filledBuys: 0,
    filledSells: 0,
  };
}

/**
 * Draw `cost` (margin + fee) from the wallet, preferring the reserved-order
 * bucket before touching free coin balance. Returns false (no funds mutated)
 * if the wallet cannot cover the cost at all — using reservedCoin + coinBalance
 * combined avoids incorrectly rejecting a fill just because the fee alone
 * exceeds the free balance while the reserve still has room for it.
 */
function drawFromWallet(wallet: CoinMWalletState, cost: number): boolean {
  const available = wallet.reservedCoin + wallet.coinBalance;
  if (available < cost) return false;

  if (wallet.reservedCoin >= cost) {
    wallet.reservedCoin -= cost;
  } else {
    wallet.coinBalance -= cost - wallet.reservedCoin;
    wallet.reservedCoin = 0;
  }
  return true;
}

function executeBuyLong(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  leverage: number,
): void {
  const margin = marginForBtcPosition(cell.quantity, leverage);
  const fee = inverseTradeFeeBtc(cell.quantity, feeRate);

  if (!drawFromWallet(wallet, margin + fee)) return;

  wallet.lots.push({
    btcSize: cell.quantity,
    entryPrice: cell.buyPrice,
    gridLevel: cell.level,
  });
  wallet.btcHeld = totalBtc(wallet.lots);
  wallet.filledBuys++;
}

function executeOpenShort(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  leverage: number,
): void {
  const margin = marginForBtcPosition(cell.quantity, leverage);
  const fee = inverseTradeFeeBtc(cell.quantity, feeRate);

  if (!drawFromWallet(wallet, margin + fee)) return;

  wallet.lots.push({
    btcSize: cell.quantity,
    entryPrice: cell.sellPrice,
    gridLevel: cell.level,
  });
  syncBtcHeld(wallet, "short");
  wallet.filledSells++;
}

function closeLongLot(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  lotIdx: number,
  leverage: number,
  closeQty?: number,
): void {
  const lot = wallet.lots[lotIdx];
  const qty = Math.min(closeQty ?? cell.quantity, lot.btcSize);
  if (qty <= 0) return;

  const gross = inverseLongCycleProfitBtc(qty, lot.entryPrice, cell.sellPrice);
  const closeFee = inverseTradeFeeBtc(qty, feeRate);

  wallet.realizedPnl += gross - closeFee;
  wallet.coinBalance += gross - closeFee + marginForBtcPosition(qty, leverage);

  if (qty >= lot.btcSize - 1e-12) {
    wallet.lots.splice(lotIdx, 1);
  } else {
    lot.btcSize -= qty;
  }
  wallet.btcHeld = totalBtc(wallet.lots);
  wallet.filledSells++;
}

function findLongLotForSell(
  wallet: CoinMWalletState,
  cell: GridCell,
): number {
  const byLevel = wallet.lots.findIndex((l) => l.gridLevel === cell.level);
  if (byLevel >= 0) return byLevel;

  const byBuy = wallet.lots.findIndex(
    (l) => Math.abs(l.entryPrice - cell.buyPrice) < 0.0001,
  );
  if (byBuy >= 0) return byBuy;

  const pool = wallet.lots.findIndex((l) => l.gridLevel === 0);
  if (pool >= 0) return pool;

  return wallet.lots.length > 0 ? 0 : -1;
}

function matchCloseLong(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  leverage: number,
): void {
  const lotIdx = findLongLotForSell(wallet, cell);
  if (lotIdx < 0) return;
  closeLongLot(wallet, cell, feeRate, lotIdx, leverage, cell.quantity);
}

function closeShortLot(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  lotIdx: number,
  leverage: number,
  closeQty?: number,
): void {
  const lot = wallet.lots[lotIdx];
  const qty = Math.min(closeQty ?? cell.quantity, lot.btcSize);
  if (qty <= 0) return;

  const gross = inverseShortUnrealizedBtc(qty, lot.entryPrice, cell.buyPrice);
  const closeFee = inverseTradeFeeBtc(qty, feeRate);

  wallet.realizedPnl += gross - closeFee;
  wallet.coinBalance += gross - closeFee + marginForBtcPosition(qty, leverage);

  if (qty >= lot.btcSize - 1e-12) {
    wallet.lots.splice(lotIdx, 1);
  } else {
    lot.btcSize -= qty;
  }
  syncBtcHeld(wallet, "short");
  wallet.filledBuys++;
}

function findShortLotForCover(
  wallet: CoinMWalletState,
  cell: GridCell,
): number {
  const byLevel = wallet.lots.findIndex((l) => l.gridLevel === cell.level);
  if (byLevel >= 0) return byLevel;

  const bySell = wallet.lots.findIndex(
    (l) => Math.abs(l.entryPrice - cell.sellPrice) < 0.0001,
  );
  if (bySell >= 0) return bySell;

  const pool = wallet.lots.findIndex((l) => l.gridLevel === 0);
  if (pool >= 0) return pool;

  return wallet.lots.length > 0 ? 0 : -1;
}

function matchCloseShort(
  wallet: CoinMWalletState,
  cell: GridCell,
  feeRate: number,
  leverage: number,
): void {
  const lotIdx = findShortLotForCover(wallet, cell);
  if (lotIdx < 0) return;
  closeShortLot(wallet, cell, feeRate, lotIdx, leverage, cell.quantity);
}

function liquidateRemainingLongLots(
  wallet: CoinMWalletState,
  price: number,
  feeRate: number,
  leverage: number,
): void {
  while (wallet.lots.length > 0) {
    const lot = wallet.lots[0];
    const gross = inverseLongCycleProfitBtc(lot.btcSize, lot.entryPrice, price);
    const closeFee = inverseTradeFeeBtc(lot.btcSize, feeRate);
    wallet.realizedPnl += gross - closeFee;
    wallet.coinBalance += gross - closeFee + marginForBtcPosition(lot.btcSize, leverage);
    wallet.lots.shift();
    wallet.filledSells++;
  }
  wallet.btcHeld = 0;
}

function settleImmediateSellsAtStart(
  wallet: CoinMWalletState,
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  _feeRate: number,
  _leverage: number,
): void {
  // Long Coin-M: initial position stays intact at start — no retroactive sells from
  // pool entry at startPrice (would wrongly realize losses on levels below start).
  if (direction === "long") return;
  if (direction === "short") return;

  for (const cell of cells) {
    if (cell.sellPrice <= startPrice) {
      matchCloseLong(wallet, cell, _feeRate, _leverage);
    }
  }
}

export function createCoinMWalletAtStart(
  input: GridCalculatorInput,
  cells: GridCell[],
  meta: CoinMGridMeta,
): CoinMWalletState {
  const feeRate = input.feePercent / 100;
  const wallet = initCoinMWallet(cells, input.startBotPrice, input.direction, input, meta);
  settleImmediateSellsAtStart(
    wallet,
    cells,
    input.startBotPrice,
    input.direction,
    feeRate,
    input.leverage,
  );
  return wallet;
}

export function walkCoinMPrice(
  wallet: CoinMWalletState,
  cells: GridCell[],
  fromPrice: number,
  toPrice: number,
  direction: GridCalculatorInput["direction"],
  feeRate: number,
  upperPrice: number,
  leverage: number,
): void {
  if (fromPrice === toPrice) return;

  const movingDown = toPrice < fromPrice;

  if (direction === "short") {
    if (movingDown) {
      for (const cell of [...cells].reverse()) {
        if (cell.buyPrice >= toPrice && cell.buyPrice < fromPrice) {
          matchCloseShort(wallet, cell, feeRate, leverage);
        }
      }
    } else {
      for (const cell of cells) {
        if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
          executeOpenShort(wallet, cell, feeRate, leverage);
        }
      }
    }
    return;
  }

  if (movingDown) {
    for (const cell of [...cells].reverse()) {
      if (cell.buyPrice < fromPrice && cell.buyPrice >= toPrice) {
        executeBuyLong(wallet, cell, feeRate, leverage);
      }
    }
    return;
  }

  for (const cell of cells) {
    if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
      matchCloseLong(wallet, cell, feeRate, leverage);
    }
  }

  if (wallet.lots.length > 0 && toPrice >= upperPrice) {
    liquidateRemainingLongLots(wallet, toPrice, feeRate, leverage);
  }
}

export function coinMWalletUnrealizedPnl(
  wallet: CoinMWalletState,
  price: number,
  input: GridCalculatorInput,
): number {
  return unrealizedFromLots(wallet.lots, price, input.direction);
}

export function coinMWalletEquity(
  wallet: CoinMWalletState,
  price: number,
  input: GridCalculatorInput,
): number {
  const unrealized = coinMWalletUnrealizedPnl(wallet, price, input);
  return wallet.walletMargin + wallet.realizedPnl + unrealized;
}
