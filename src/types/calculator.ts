export type GridType = "arithmetic" | "geometric";
export type Direction = "neutral" | "long" | "short";

export interface GridCalculatorInput {
  upperPrice: number;
  lowerPrice: number;
  currentPrice: number;
  startBotPrice: number;
  gridCount: number;
  margin: number;
  addedMargin: number;
  feePercent: number;
  leverage: number;
  maintenanceMarginPercent: number;
  direction: Direction;
  gridType: GridType;
}

/** USDT notional allocated to grid orders (margin × leverage). */
export function gridInvestment(input: Pick<GridCalculatorInput, "margin" | "leverage">): number {
  const lev = input.leverage > 0 ? input.leverage : 1;
  return input.margin * lev;
}

export function totalWallet(input: Pick<GridCalculatorInput, "margin" | "addedMargin">): number {
  return input.margin + input.addedMargin;
}

export function isBotStarted(currentPrice: number, startBotPrice: number): boolean {
  if (startBotPrice < currentPrice) return currentPrice <= startBotPrice;
  if (startBotPrice > currentPrice) return currentPrice >= startBotPrice;
  return true;
}

export interface GridOrder {
  level: number;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  quoteAmount: number;
  status: "placed" | "initial" | "pending";
}

export interface GridCell {
  level: number;
  buyPrice: number;
  sellPrice: number;
  quotePerGrid: number;
  quantity: number;
  grossProfit: number;
  fee: number;
  netProfit: number;
  profitPercent: number;
  netProfitPercent: number;
  zone: "below" | "above" | "current";
}

export interface MarginInfo {
  marginUsed: number;
  freeMargin: number;
  marginRatio: number;
  positionNotional: number;
}

export interface PriceSimulation {
  targetPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  coinHeld: number;
  usdtBalance: number;
  totalEquity: number;
  avgCost: number;
  filledBuys: number;
  filledSells: number;
  liquidationPrice: number;
  distanceToLiqPercent: number;
  margin: MarginInfo;
}

export interface GridCalculatorResult {
  priceLevels: number[];
  cells: GridCell[];
  orders: GridOrder[];
  spacing: number;
  spacingPercent: number;
  quotePerGrid: number;
  profitPerGridMin: number;
  profitPerGridMax: number;
  profitPerGridAvg: number;
  netProfitPercentMin: number;
  netProfitPercentMax: number;
  netProfitPercentAvg: number;
  profitPerGridUsdtMin: number;
  profitPerGridUsdtMax: number;
  buyOrdersBelow: number;
  sellOrdersAbove: number;
  initialCoin: number;
  initialUsdt: number;
  initialCoinValue: number;
  totalPosition: number;
  breakEvenSpacingPercent: number;
  margin: MarginInfo;
  liquidationPrice: number;
  distanceToLiqPercent: number;
  simulationAtStart: PriceSimulation;
  simulationAtUpper: PriceSimulation;
  simulationAtLower: PriceSimulation;
  simulationAtCurrent: PriceSimulation;
  holdingsAtStart: { coin: number; usdt: number };
  startBotPrice: number;
  botStarted: boolean;
  totalWallet: number;
  liquidationPriceBase: number;
  investment: number;
  marginCollateral: number;
}
