/** Binance COIN-M futures grid constants & sizing (matches exchange confirmation UI). */

export const BTC_CONTRACT_USD = 100;
export const ETH_CONTRACT_USD = 10;

export function contractUsdForSymbol(symbol: string): number {
  return symbol === "ETH" ? ETH_CONTRACT_USD : BTC_CONTRACT_USD;
}

/** Long: 73% margin → initial position, 27% → grid order reserve (Binance COIN-M grid). */
export function deployRatios(direction: "neutral" | "long" | "short"): {
  deployRatio: number;
  reserveRatio: number;
} {
  if (direction === "long") return { deployRatio: 0.73, reserveRatio: 0.27 };
  if (direction === "short") return { deployRatio: 0.27, reserveRatio: 0.73 };
  return { deployRatio: 0.5, reserveRatio: 0.5 };
}

/**
 * Count of grid order slots funded from the order-reserve bucket.
 * Long: when start is in the lower half of the range, slots ≈ sellAbove − gridCount/2
 *       (matches Binance ~144 USDT/grid); otherwise 2×buyBelow − 2.
 * Short: mirrored using buyBelow above mid-range.
 */
export function countOrderSlots(
  buyBelow: number,
  sellAbove: number,
  direction: "neutral" | "long" | "short",
  gridCount: number,
): number {
  const half = Math.floor(gridCount / 2);

  if (direction === "long") {
    if (sellAbove > half) return Math.max(1, sellAbove - half);
    return Math.max(1, 2 * buyBelow - 2);
  }

  if (direction === "short") {
    if (buyBelow > half) return Math.max(1, buyBelow - half);
    return Math.max(1, 2 * sellAbove - 2);
  }

  return Math.max(1, buyBelow + sellAbove);
}

/** USD notional per grid — Binance: reserveMargin × leverage / orderSlots. */
export function quotePerGridUsd(
  marginCoin: number,
  markPrice: number,
  leverage: number,
  reserveRatio: number,
  orderSlots: number,
): number {
  if (orderSlots < 1 || markPrice <= 0) return 0;
  const lev = leverage > 0 ? leverage : 1;
  const orderBudgetUsd = marginCoin * reserveRatio * lev * markPrice;
  return orderBudgetUsd / orderSlots;
}

/** Initial open position (BTC) for long/short grid at start. */
export function initialOpenValueBtc(
  marginCoin: number,
  leverage: number,
  deployRatio: number,
): number {
  const lev = leverage > 0 ? leverage : 1;
  return marginCoin * lev * deployRatio;
}

/** Round to integer contracts (Binance COIN-M rule). */
export function contractsFromUsd(notionalUsd: number, contractUsd: number): number {
  if (contractUsd <= 0) return 0;
  return Math.max(1, Math.round(notionalUsd / contractUsd));
}

/** BTC size for an order at price P from USD notional. */
export function btcFromUsdNotional(notionalUsd: number, price: number): number {
  return price > 0 ? notionalUsd / price : 0;
}

export function marginForBtcPosition(btcSize: number, leverage: number): number {
  const lev = leverage > 0 ? leverage : 1;
  return btcSize / lev;
}

/** Long / neutral grid cycle profit in coin (inverse). */
export function inverseLongCycleProfitBtc(
  btcSize: number,
  buyPrice: number,
  sellPrice: number,
): number {
  if (buyPrice <= 0 || sellPrice <= 0) return 0;
  return btcSize * buyPrice * (1 / buyPrice - 1 / sellPrice);
}

/** Short grid cycle profit in coin (inverse). */
export function inverseShortCycleProfitBtc(
  btcSize: number,
  buyPrice: number,
  sellPrice: number,
): number {
  if (buyPrice <= 0 || sellPrice <= 0) return 0;
  return btcSize * sellPrice * (1 / buyPrice - 1 / sellPrice);
}

export function inverseLongUnrealizedBtc(
  btcSize: number,
  entryPrice: number,
  markPrice: number,
): number {
  if (entryPrice <= 0 || markPrice <= 0) return 0;
  return btcSize * entryPrice * (1 / entryPrice - 1 / markPrice);
}

export function inverseShortUnrealizedBtc(
  btcSize: number,
  entryPrice: number,
  markPrice: number,
): number {
  if (entryPrice <= 0 || markPrice <= 0) return 0;
  return btcSize * entryPrice * (1 / markPrice - 1 / entryPrice);
}

/** Inverse fee in coin ≈ feeRate × btc order size. */
export function inverseTradeFeeBtc(btcSize: number, feeRate: number): number {
  return feeRate * btcSize;
}

/** BTC COIN-M maintenance margin rate tier by USD notional (approx. Binance brackets). */
export function coinMMmrPercent(notionalUsd: number, userMaintPercent: number): number {
  if (notionalUsd < 5_000) return Math.max(userMaintPercent, 0.4);
  if (notionalUsd < 25_000) return Math.max(userMaintPercent, 1);
  if (notionalUsd < 100_000) return Math.max(userMaintPercent, 2.5);
  if (notionalUsd < 500_000) return Math.max(userMaintPercent, 5);
  return Math.max(userMaintPercent, 10);
}

/**
 * Inverse isolated long liquidation.
 * margin_balance = maintenance_margin at L:
 * W + q×E×(1/E − 1/L) = mmr × q×E/L
 */
export function calculateCoinMLiquidationLong(
  entryPrice: number,
  btcQty: number,
  walletBalanceCoin: number,
  maintenanceMarginPercent: number,
  notionalUsd?: number,
): number {
  if (btcQty <= 0 || entryPrice <= 0) return 0;
  const mmr = coinMMmrPercent(notionalUsd ?? btcQty * entryPrice, maintenanceMarginPercent) / 100;
  const denom = walletBalanceCoin + btcQty;
  if (denom <= 0) return 0;
  const liq = (btcQty * entryPrice * (1 + mmr)) / denom;
  return liq > 0 && Number.isFinite(liq) ? liq : 0;
}

export function calculateCoinMLiquidationShort(
  entryPrice: number,
  btcQty: number,
  walletBalanceCoin: number,
  maintenanceMarginPercent: number,
  notionalUsd?: number,
): number {
  if (btcQty <= 0 || entryPrice <= 0) return 0;
  const mmr = coinMMmrPercent(notionalUsd ?? btcQty * entryPrice, maintenanceMarginPercent) / 100;
  const denom = walletBalanceCoin - btcQty;
  if (denom <= 0) return 0;
  const liq = (btcQty * entryPrice * (1 - mmr)) / denom;
  return liq > 0 && Number.isFinite(liq) ? liq : 0;
}

export function buildCoinMWarnings(
  marginCoin: number,
  leverage: number,
  openValueBtc: number,
  coinSymbol: string,
): string[] {
  const warnings: string[] = [];
  const lev = leverage > 0 ? leverage : 1;
  const maxExposure = marginCoin * lev;
  if (openValueBtc > maxExposure * 1.001) {
    warnings.push(
      `Open value (~${openValueBtc.toFixed(6)} ${coinSymbol}) exceeds max leverage exposure (~${maxExposure.toFixed(6)} ${coinSymbol}).`,
    );
  }
  return warnings;
}
