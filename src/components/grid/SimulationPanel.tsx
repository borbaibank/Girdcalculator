import { StatCard } from "@/components/ui/StatCard";
import type { PriceSimulation } from "@/types/calculator";
import { formatNumber, formatPercent, formatUsd } from "@/lib/utils/format";

interface SimulationPanelProps {
  title: string;
  subtitle: string;
  sim: PriceSimulation;
  investment: number;
  coinLabel?: string;
  emphasizeCoin?: boolean;
}

export function SimulationPanel({
  title,
  subtitle,
  sim,
  investment,
  coinLabel = "เหรียญถือ",
  emphasizeCoin = false,
}: SimulationPanelProps) {
  const pnlVariant = sim.totalPnl >= 0 ? "success" : "danger";
  const unrealizedVariant = sim.unrealizedPnl >= 0 ? "success" : "danger";
  const realizedVariant = sim.realizedPnl >= 0 ? "success" : "danger";

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
          label={coinLabel}
          value={formatNumber(sim.coinHeld, 6)}
          variant={emphasizeCoin ? "primary" : "default"}
        />
        <StatCard
          compact
          label="กำไร Realized (Grid ขาย)"
          value={formatUsd(sim.realizedPnl)}
          variant={realizedVariant}
        />
        <StatCard
          compact
          label="กำไร/ขาดทุน Unrealized (เหรียญ)"
          value={formatUsd(sim.unrealizedPnl)}
          variant={unrealizedVariant}
        />
        <StatCard
          compact
          label="กำไรรวม"
          value={formatUsd(sim.totalPnl)}
          variant={pnlVariant}
        />
        <StatCard compact label="USDT คงเหลือ" value={formatUsd(sim.usdtBalance)} />
        <StatCard compact label="มูลค่ารวม" value={formatUsd(sim.totalEquity)} variant="primary" />
        <StatCard compact label="Avg Cost" value={`$${formatNumber(sim.avgCost)}`} />
        <StatCard compact label="Buy ที่ Fill" value={String(sim.filledBuys)} />
        <StatCard compact label="Sell ที่ Fill" value={String(sim.filledSells)} />
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
            ห่างจากราคาเป้าหมาย {formatPercent(sim.distanceToLiqPercent)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Margin @ Target
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Used</p>
              <p className="font-semibold">{formatUsd(sim.margin.marginUsed)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Free</p>
              <p className="font-semibold text-[var(--color-success)]">
                {formatUsd(sim.margin.freeMargin)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            ROI {formatPercent((sim.totalPnl / investment) * 100)} จากทุน {formatUsd(investment)}
          </p>
        </div>
      </div>
    </div>
  );
}
