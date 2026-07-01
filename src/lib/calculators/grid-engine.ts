import type { GridCalculatorInput, GridCell } from "@/types/calculator";
import { gridInvestment } from "@/types/calculator";
import {
  computeUsdtMFuturesAllocation,
  countGridsFromCells,
} from "@/lib/calculators/usdt-m-allocation";

export interface InventoryLot {
  quantity: number;
  entryPrice: number;
  gridLevel: number;
}

export interface GridWalletState {
  coin: number;
  usdt: number;
  realizedPnl: number;
  lots: InventoryLot[];
  filledBuys: number;
  filledSells: number;
}

function totalCoin(lots: InventoryLot[]): number {
  return lots.reduce((s, l) => s + l.quantity, 0);
}

export function initWallet(
  cells: GridCell[],
  startPrice: number,
  quotePerGrid: number,
  direction: GridCalculatorInput["direction"],
  input?: GridCalculatorInput,
): GridWalletState {
  const lots: InventoryLot[] = [];
  let usdt = 0;
  let coin = 0;

  if ((direction === "long" || direction === "short") && input) {
    const counts = countGridsFromCells(cells, startPrice);
    const alloc = computeUsdtMFuturesAllocation(input, counts);
    const openQty = alloc.openQty;

    if (direction === "long") {
      lots.push({ quantity: openQty, entryPrice: startPrice, gridLevel: 0 });
      coin = openQty;
    } else {
      const shortCells = cells.filter((c) => c.sellPrice > startPrice);
      for (const cell of shortCells) {
        lots.push({ quantity: cell.quantity, entryPrice: startPrice, gridLevel: cell.level });
      }
      coin = -totalCoin(lots);
    }

    usdt = alloc.freeMargin;
    return {
      coin,
      usdt,
      realizedPnl: 0,
      lots,
      filledBuys: 0,
      filledSells: direction === "short" ? counts.sellAbove : 0,
    };
  }

  const sellCells = cells.filter((c) => c.sellPrice > startPrice);
  const buyCells = cells.filter((c) => c.buyPrice < startPrice);

  for (const cell of sellCells) {
    const qty = quotePerGrid / startPrice;
    lots.push({ quantity: qty, entryPrice: startPrice, gridLevel: cell.level });
  }
  coin = totalCoin(lots);
  usdt = buyCells.length * quotePerGrid;

  return { coin, usdt, realizedPnl: 0, lots, filledBuys: 0, filledSells: 0 };
}

function executeBuy(
  wallet: GridWalletState,
  cell: GridCell,
  feeRate: number,
  direction: GridCalculatorInput["direction"],
  leverage: number,
): void {
  const lev = leverage > 0 ? leverage : 1;
  const isFutures = direction === "long" || direction === "short";
  const cost = isFutures ? cell.quotePerGrid / lev : cell.quotePerGrid;
  const fee = cell.quotePerGrid * feeRate;
  if (wallet.usdt < cost + fee) return;

  wallet.usdt -= cost + fee;
  wallet.lots.push({
    quantity: cell.quantity,
    entryPrice: cell.buyPrice,
    gridLevel: cell.level,
  });
  wallet.coin = direction === "short" ? -totalCoin(wallet.lots) : totalCoin(wallet.lots);
  wallet.filledBuys++;
}

function executeSellFromLevel(
  wallet: GridWalletState,
  cell: GridCell,
  feeRate: number,
  direction: GridCalculatorInput["direction"],
  leverage: number,
): void {
  const lotIdx = wallet.lots.findIndex((l) => l.gridLevel === cell.level);
  if (lotIdx < 0) return;

  const lot = wallet.lots[lotIdx];
  const revenue = cell.sellPrice * lot.quantity;
  const fee = revenue * feeRate;
  const cost = lot.entryPrice * lot.quantity;
  const buyFee = cost * feeRate;
  const lev = leverage > 0 ? leverage : 1;
  const isFutures = direction === "long" || direction === "short";

  wallet.realizedPnl += revenue - cost - fee - buyFee;
  wallet.usdt += isFutures ? cost / lev - fee : revenue - fee;
  wallet.lots.splice(lotIdx, 1);
  wallet.coin = direction === "short" ? -totalCoin(wallet.lots) : totalCoin(wallet.lots);
  wallet.filledSells++;
}

function closeLotQty(
  wallet: GridWalletState,
  lot: InventoryLot,
  lotIdx: number,
  sellPrice: number,
  closeQty: number,
  feeRate: number,
  direction: GridCalculatorInput["direction"],
  leverage: number,
): void {
  const qty = Math.min(closeQty, lot.quantity);
  if (qty <= 0) return;

  const revenue = sellPrice * qty;
  const fee = revenue * feeRate;
  const cost = lot.entryPrice * qty;
  const buyFee = cost * feeRate;
  const lev = leverage > 0 ? leverage : 1;
  const isFutures = direction === "long" || direction === "short";

  wallet.realizedPnl += revenue - cost - fee - buyFee;
  wallet.usdt += isFutures ? cost / lev - fee : revenue - fee;

  if (qty >= lot.quantity - 1e-12) {
    wallet.lots.splice(lotIdx, 1);
  } else {
    lot.quantity -= qty;
  }
  wallet.filledSells++;
}

function matchSellLots(
  wallet: GridWalletState,
  cell: GridCell,
  feeRate: number,
  direction: GridCalculatorInput["direction"],
  leverage: number,
): void {
  const lotIdx = wallet.lots.findIndex(
    (l) => l.gridLevel === cell.level || Math.abs(l.entryPrice - cell.buyPrice) < 0.0001,
  );
  if (lotIdx < 0) {
    if (wallet.lots.length === 0) return;
    closeLotQty(
      wallet,
      wallet.lots[0],
      0,
      cell.sellPrice,
      cell.quantity,
      feeRate,
      direction,
      leverage,
    );
  } else {
    executeSellFromLevel(wallet, cell, feeRate, direction, leverage);
  }
  wallet.coin = direction === "short" ? -totalCoin(wallet.lots) : totalCoin(wallet.lots);
}

function liquidateRemainingLots(
  wallet: GridWalletState,
  price: number,
  feeRate: number,
  direction: GridCalculatorInput["direction"],
  leverage: number,
): void {
  const lev = leverage > 0 ? leverage : 1;
  const isFutures = direction === "long" || direction === "short";

  while (wallet.lots.length > 0) {
    const lot = wallet.lots[0];
    const revenue = price * lot.quantity;
    const fee = revenue * feeRate;
    const cost = lot.entryPrice * lot.quantity;
    const buyFee = cost * feeRate;
    wallet.realizedPnl += revenue - cost - fee - buyFee;
    wallet.usdt += isFutures ? cost / lev - fee : revenue - fee;
    wallet.lots.shift();
    wallet.filledSells++;
  }
  wallet.coin = direction === "short" ? -totalCoin(wallet.lots) : totalCoin(wallet.lots);
}

function settleImmediateSellsAtStart(
  wallet: GridWalletState,
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  _feeRate: number,
): void {
  // Long/short futures grid: initial position stays intact at start — no retroactive sells.
  if (direction === "long") return;
  if (direction === "short") return;

  for (const cell of cells) {
    if (cell.sellPrice <= startPrice) {
      matchSellLots(wallet, cell, _feeRate, direction, 1);
    }
  }
}

export function createWalletAtStart(
  input: GridCalculatorInput,
  cells: GridCell[],
): GridWalletState {
  const quotePerGrid = gridInvestment(input) / input.gridCount;
  const feeRate = input.feePercent / 100;
  const wallet = initWallet(cells, input.startBotPrice, quotePerGrid, input.direction, input);
  settleImmediateSellsAtStart(wallet, cells, input.startBotPrice, input.direction, feeRate);
  return wallet;
}

export function walkPrice(
  wallet: GridWalletState,
  cells: GridCell[],
  fromPrice: number,
  toPrice: number,
  direction: GridCalculatorInput["direction"],
  feeRate: number,
  upperPrice: number,
  leverage = 1,
): void {
  if (fromPrice === toPrice) return;

  const movingDown = toPrice < fromPrice;

  if (direction === "short") {
    if (movingDown) {
      for (const cell of [...cells].reverse()) {
        if (cell.buyPrice >= toPrice && cell.buyPrice < fromPrice) {
          matchSellLots(wallet, cell, feeRate, direction, leverage);
        }
      }
    } else {
      for (const cell of cells) {
        if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
          executeBuy(wallet, cell, feeRate, direction, leverage);
        }
      }
    }
    return;
  }

  if (movingDown) {
    for (const cell of [...cells].reverse()) {
      if (cell.buyPrice < fromPrice && cell.buyPrice >= toPrice) {
        executeBuy(wallet, cell, feeRate, direction, leverage);
      }
    }
    return;
  }

  for (const cell of cells) {
    if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
      matchSellLots(wallet, cell, feeRate, direction, leverage);
    }
  }

  if (wallet.lots.length > 0 && toPrice >= upperPrice) {
    liquidateRemainingLots(wallet, toPrice, feeRate, direction, leverage);
  }
}

/** Walk one price segment; returns completed grid cycles in this segment. */
export function walkPriceSegment(
  wallet: GridWalletState,
  cells: GridCell[],
  fromPrice: number,
  toPrice: number,
  input: Pick<GridCalculatorInput, "direction" | "feePercent" | "upperPrice" | "leverage">,
): { cycles: number; buys: number; sells: number } {
  const feeRate = input.feePercent / 100;
  const buysBefore = wallet.filledBuys;
  const sellsBefore = wallet.filledSells;

  walkPrice(
    wallet,
    cells,
    fromPrice,
    toPrice,
    input.direction,
    feeRate,
    input.upperPrice,
    input.leverage,
  );

  const buys = wallet.filledBuys - buysBefore;
  const sells = wallet.filledSells - sellsBefore;
  const movingUp = toPrice > fromPrice;
  const movingDown = toPrice < fromPrice;

  let cycles = 0;
  if (input.direction === "short") {
    cycles = movingDown ? sells : 0;
  } else {
    cycles = movingUp ? sells : 0;
  }

  return { cycles, buys, sells };
}

export function walletUnrealizedPnl(
  wallet: GridWalletState,
  price: number,
  direction: GridCalculatorInput["direction"],
): number {
  if (direction === "short") {
    return wallet.lots.reduce((s, l) => s + (l.entryPrice - price) * l.quantity, 0);
  }
  return wallet.lots.reduce((s, l) => s + (price - l.entryPrice) * l.quantity, 0);
}

export function walletEquity(wallet: GridWalletState, price: number): number {
  return wallet.usdt + wallet.coin * price;
}
