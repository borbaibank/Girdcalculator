import type { GridCell, GridCalculatorInput, MarginInfo, PriceSimulation } from "@/types/calculator";
import { gridInvestment, totalWallet } from "@/types/calculator";

interface InventoryLot {
  quantity: number;
  entryPrice: number;
  gridLevel: number;
}

interface WalletState {
  coin: number;
  usdt: number;
  realizedPnl: number;
  lots: InventoryLot[];
  filledBuys: number;
  filledSells: number;
}

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

function weightedAvgCost(lots: InventoryLot[]): number {
  const totalQty = lots.reduce((s, l) => s + l.quantity, 0);
  if (totalQty <= 0) return 0;
  return lots.reduce((s, l) => s + l.entryPrice * l.quantity, 0) / totalQty;
}

function totalCoin(lots: InventoryLot[]): number {
  return lots.reduce((s, l) => s + l.quantity, 0);
}

function initWallet(
  cells: GridCell[],
  startPrice: number,
  quotePerGrid: number,
  direction: GridCalculatorInput["direction"],
): WalletState {
  const lots: InventoryLot[] = [];
  let usdt = 0;
  let coin = 0;

  if (direction === "long") {
    for (const cell of cells) {
      lots.push({ quantity: cell.quantity, entryPrice: startPrice, gridLevel: cell.level });
    }
    coin = totalCoin(lots);
    return { coin, usdt: 0, realizedPnl: 0, lots, filledBuys: cells.length, filledSells: 0 };
  }

  if (direction === "short") {
    const shortCells = cells.filter((c) => c.sellPrice > startPrice);
    for (const cell of shortCells) {
      lots.push({ quantity: cell.quantity, entryPrice: startPrice, gridLevel: cell.level });
    }
    coin = -totalCoin(lots);
    usdt = cells.filter((c) => c.buyPrice < startPrice).length * quotePerGrid;
    return { coin, usdt, realizedPnl: 0, lots, filledBuys: 0, filledSells: shortCells.length };
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

function executeBuy(wallet: WalletState, cell: GridCell, feeRate: number): void {
  const cost = cell.quotePerGrid;
  const fee = cost * feeRate;
  if (wallet.usdt < cost + fee) return;

  wallet.usdt -= cost + fee;
  wallet.lots.push({
    quantity: cell.quantity,
    entryPrice: cell.buyPrice,
    gridLevel: cell.level,
  });
  wallet.coin = totalCoin(wallet.lots);
  wallet.filledBuys++;
}

function executeSellFromLevel(wallet: WalletState, cell: GridCell, feeRate: number): void {
  const lotIdx = wallet.lots.findIndex((l) => l.gridLevel === cell.level);
  if (lotIdx < 0) return;

  const lot = wallet.lots[lotIdx];
  const revenue = cell.sellPrice * lot.quantity;
  const fee = revenue * feeRate;
  const cost = lot.entryPrice * lot.quantity;
  const buyFee = cost * feeRate;

  wallet.realizedPnl += revenue - cost - fee - buyFee;
  wallet.usdt += revenue - fee;
  wallet.lots.splice(lotIdx, 1);
  wallet.coin = totalCoin(wallet.lots);
  wallet.filledSells++;
}

function matchSellLots(wallet: WalletState, cell: GridCell, feeRate: number): void {
  const lotIdx = wallet.lots.findIndex(
    (l) => l.gridLevel === cell.level || Math.abs(l.entryPrice - cell.buyPrice) < 0.0001,
  );
  if (lotIdx < 0) {
    if (wallet.lots.length === 0) return;
    const lot = wallet.lots[0];
    const revenue = cell.sellPrice * lot.quantity;
    const fee = revenue * feeRate;
    const cost = lot.entryPrice * lot.quantity;
    const buyFee = cost * feeRate;
    wallet.realizedPnl += revenue - cost - fee - buyFee;
    wallet.usdt += revenue - fee;
    wallet.lots.shift();
    wallet.filledSells++;
  } else {
    executeSellFromLevel(wallet, cell, feeRate);
  }
  wallet.coin = totalCoin(wallet.lots);
}

function liquidateRemainingLots(
  wallet: WalletState,
  price: number,
  feeRate: number,
): void {
  while (wallet.lots.length > 0) {
    const lot = wallet.lots[0];
    const revenue = price * lot.quantity;
    const fee = revenue * feeRate;
    const cost = lot.entryPrice * lot.quantity;
    const buyFee = cost * feeRate;
    wallet.realizedPnl += revenue - cost - fee - buyFee;
    wallet.usdt += revenue - fee;
    wallet.lots.shift();
    wallet.filledSells++;
  }
  wallet.coin = totalCoin(wallet.lots);
}

function settleImmediateSellsAtStart(
  wallet: WalletState,
  cells: GridCell[],
  startPrice: number,
  direction: GridCalculatorInput["direction"],
  feeRate: number,
): void {
  if (direction === "short") return;

  for (const cell of cells) {
    if (cell.sellPrice <= startPrice) {
      matchSellLots(wallet, cell, feeRate);
    }
  }
}

function walkPrice(
  wallet: WalletState,
  cells: GridCell[],
  fromPrice: number,
  toPrice: number,
  direction: GridCalculatorInput["direction"],
  feeRate: number,
  upperPrice: number,
): void {
  if (fromPrice === toPrice) return;

  const movingDown = toPrice < fromPrice;

  if (direction === "short") {
    if (movingDown) {
      for (const cell of [...cells].reverse()) {
        if (cell.buyPrice >= toPrice && cell.buyPrice < fromPrice) {
          matchSellLots(wallet, cell, feeRate);
        }
      }
    } else {
      for (const cell of cells) {
        if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
          executeBuy(wallet, cell, feeRate);
        }
      }
    }
    return;
  }

  if (movingDown) {
    for (const cell of [...cells].reverse()) {
      if (cell.buyPrice < fromPrice && cell.buyPrice >= toPrice) {
        executeBuy(wallet, cell, feeRate);
      }
    }
    return;
  }

  for (const cell of cells) {
    if (cell.sellPrice > fromPrice && cell.sellPrice <= toPrice) {
      matchSellLots(wallet, cell, feeRate);
    }
  }

  // At upper boundary only: flush any leftover inventory (all sell grids should have filled)
  if (wallet.lots.length > 0 && toPrice >= upperPrice) {
    liquidateRemainingLots(wallet, toPrice, feeRate);
  }
}

function walletToSimulation(
  wallet: WalletState,
  input: GridCalculatorInput,
  targetPrice: number,
): PriceSimulation {
  const { leverage, maintenanceMarginPercent, direction } = input;
  const walletBalance = totalWallet(input);
  const coinHeld = wallet.coin;
  const avgCost = weightedAvgCost(wallet.lots);
  const absQty = Math.abs(coinHeld);

  let unrealizedPnl = 0;
  if (direction === "short") {
    unrealizedPnl = wallet.lots.reduce(
      (s, l) => s + (l.entryPrice - targetPrice) * l.quantity,
      0,
    );
  } else {
    unrealizedPnl = wallet.lots.reduce(
      (s, l) => s + (targetPrice - l.entryPrice) * l.quantity,
      0,
    );
  }

  const totalEquity = wallet.usdt + coinHeld * targetPrice;
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

function createWalletAtStart(
  input: GridCalculatorInput,
  cells: GridCell[],
): WalletState {
  const investment = gridInvestment(input);
  const quotePerGrid = investment / input.gridCount;
  const feeRate = input.feePercent / 100;
  const wallet = initWallet(cells, input.startBotPrice, quotePerGrid, input.direction);
  settleImmediateSellsAtStart(
    wallet,
    cells,
    input.startBotPrice,
    input.direction,
    feeRate,
  );
  return wallet;
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
