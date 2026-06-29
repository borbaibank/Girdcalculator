import { StatCard } from "@/components/ui/StatCard";
import type { PriceSimulation } from "@/types/calculator";
import { formatCoin, formatNumber, formatPercent, formatUsd } from "@/lib/utils/format";

interface SimulationPanelProps {
  title: string;
  subtitle: string;
  sim: PriceSimulation;
  investment: number;
  currentPrice?: number;
  coinLabel?: string;
  emphasizeCoin?: boolean;
  /** When set, PnL and balance values display in coin instead of USD. */
  coinSymbol?: string;
  quantityLabel?: string;
}

export function SimulationPanel({
  title,
  subtitle,
  sim,
  investment,
  currentPrice,
  coinLabel = "Coin Held",
  emphasizeCoin = false,
  coinSymbol,
  quantityLabel,
}: SimulationPanelProps) {
  const fmt = (value: number, decimals = 2) =>
    coinSymbol ? formatCoin(value, coinSymbol, decimals) : formatUsd(value, decimals);

  const markPrice = currentPrice ?? sim.targetPrice;
  const showCurrentMark =
    sim.unrealizedAtCurrentPrice != null &&
    Math.abs(sim.targetPrice - markPrice) > Math.max(markPrice * 0.0001, 1);

  const pnlVariant = sim.totalPnl >= 0 ? "success" : "danger";
  const realizedVariant = sim.realizedPnl >= 0 ? "success" : "danger";
  const heldLabel = quantityLabel ?? coinLabel;
  const heldValue = coinSymbol
    ? formatCoin(sim.coinHeld, coinSymbol, 6)
    : formatNumber(sim.coinHeld, 6);
  const balanceLabel = coinSymbol ? "Coin Balance" : "USDT Balance";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-primary-glow)] px-3 py-1.5 text-sm font-bold text-[var(--color-primary)]">
          @ ${formatNumber(sim.targetPrice)}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          compact
          label={heldLabel}
          value={heldValue}
          variant={emphasizeCoin ? "primary" : "default"}
        />
        <StatCard
          compact
          label="Realized PnL (grid sells)"
          value={fmt(sim.realizedPnl, coinSymbol ? 6 : 2)}
          variant={realizedVariant}
        />
        <StatCard
          compact
          label={
            showCurrentMark
              ? `Unrealized @ $${formatNumber(sim.targetPrice)}`
              : coinSymbol
                ? "Unrealized PnL"
                : "Unrealized PnL (coin)"
          }
          value={fmt(sim.unrealizedPnl, coinSymbol ? 8 : 2)}
          variant={sim.unrealizedPnl >= 0 ? "success" : "danger"}
        />
        {showCurrentMark && (
          <StatCard
            compact
            label={`Unrealized @ $${formatNumber(markPrice)}`}
            value={fmt(sim.unrealizedAtCurrentPrice!, coinSymbol ? 8 : 2)}
            variant={
              (sim.unrealizedAtCurrentPrice ?? 0) >= 0 ? "success" : "danger"
            }
          />
        )}
        <StatCard
          compact
          label="Total PnL"
          value={fmt(sim.totalPnl, coinSymbol ? 6 : 2)}
          variant={pnlVariant}
        />
        <StatCard compact label={balanceLabel} value={fmt(sim.usdtBalance, coinSymbol ? 6 : 2)} />
        <StatCard
          compact
          label="Total Equity"
          value={fmt(sim.totalEquity, coinSymbol ? 6 : 2)}
          variant="primary"
        />
        <StatCard compact label="Avg Cost" value={`$${formatNumber(sim.avgCost)}`} />
        <StatCard compact label="Buys Filled" value={String(sim.filledBuys)} />
        <StatCard compact label="Sells Filled" value={String(sim.filledSells)} />
      </div>

      <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-dim)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">
            Liquidation Price
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--color-danger)]">
            {sim.liquidationPrice > 0 ? `$${formatNumber(sim.liquidationPrice)}` : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {formatPercent(sim.distanceToLiqPercent)} from target price
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Margin @ Target
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Used</p>
              <p className="font-semibold">{fmt(sim.margin.marginUsed, coinSymbol ? 6 : 2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Free</p>
              <p className="font-semibold text-[var(--color-success)]">
                {fmt(sim.margin.freeMargin, coinSymbol ? 6 : 2)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            ROI {formatPercent((sim.totalPnl / investment) * 100)} on{" "}
            {coinSymbol ? formatCoin(investment, coinSymbol, 4) : formatUsd(investment)} capital
          </p>
        </div>
      </div>
    </div>
  );
}
