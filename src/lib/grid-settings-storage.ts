import type { Direction, GridType, MarketType } from "@/types/calculator";

export const GRID_SETTINGS_KEY_USDT = "gridcalc-settings-usdt";
export const GRID_SETTINGS_KEY_COIN = "gridcalc-settings-coin";

export interface SavedGridSettings {
  upperPrice: string;
  lowerPrice: string;
  currentPrice: string;
  startBotPrice: string;
  gridCount: string;
  margin: string;
  addedMargin: string;
  feePercent: string;
  leverage: string;
  maintenanceMargin: string;
  direction: Direction;
  gridType: GridType;
  contractSize?: string;
  coinSymbol?: string;
}

function settingsKey(market: MarketType): string {
  return market === "coin-m" ? GRID_SETTINGS_KEY_COIN : GRID_SETTINGS_KEY_USDT;
}

export function loadGridSettings(market: MarketType = "usdt-m"): SavedGridSettings | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(settingsKey(market));
    if (!raw && market === "usdt-m") {
      raw = localStorage.getItem("gridcalc-settings");
    }
    if (!raw) return null;
    return JSON.parse(raw) as SavedGridSettings;
  } catch {
    return null;
  }
}

export function saveGridSettings(
  settings: SavedGridSettings,
  market: MarketType = "usdt-m",
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(settingsKey(market), JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}
