import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCoinMProfitPerGridRange } from "@/lib/calculators/coin-m-grid";
import { formatProfitPerGridRange } from "@/lib/calculators/grid";
import { formatCoin, formatNumber, formatPercent, formatUsd } from "@/lib/utils/format";
import type { GridCalculatorResult, GridType, PriceSimulation } from "@/types/calculator";

interface GridResultsPanelProps {
  result: GridCalculatorResult;
  isCoinM: boolean;
  coinSymbol: string;
  gridType: GridType;
  currentPrice: number;
  addedMargin: number;
  fmtValue: (value: number, decimals?: number) => string;
  fmtProfit: (value: number) => string;
}

interface ScenarioRow {
  id: string;
  label: string;
  price: number;
  sim: PriceSimulation;
  highlight?: boolean;
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]";
}

export function GridResultsPanel({
  result,
  isCoinM,
  coinSymbol,
  gridType,
  currentPrice,
  addedMargin,
  fmtValue,
  fmtProfit,
}: GridResultsPanelProps) {
  const cur = result.simulationAtCurrent;
  const holdingLabel = isCoinM ? coinSymbol : "Coin";

  const scenarios: ScenarioRow[] = [
    {
      id: "start",
      label: "Start",
      price: result.startBotPrice,
      sim: result.simulationAtStart,
    },
    {
      id: "current",
      label: "Current",
      price: currentPrice,
      sim: cur,
      highlight: true,
    },
    {
      id: "lower",
      label: "Lower",
      price: result.simulationAtLower.targetPrice,
      sim: result.simulationAtLower,
    },
    {
      id: "upper",
      label: "Upper",
      price: result.simulationAtUpper.targetPrice,
      sim: result.simulationAtUpper,
    },
  ];

  const profitRange = isCoinM
    ? formatCoinMProfitPerGridRange(
        result.gridProfitPercentMin ?? result.netProfitPercentMin,
        result.gridProfitPercentMax ?? result.netProfitPercentMax,
        gridType,
      )
    : formatProfitPerGridRange(result.netProfitPercentMin, result.netProfitPercentMax, gridType);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card-highlight">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label mb-1">Profit per grid (after fee)</p>
            <p className="text-4xl font-bold tracking-tight gradient-text sm:text-5xl">{profitRange}</p>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              {fmtProfit(result.profitPerGridMin)} – {fmtProfit(result.profitPerGridMax)} per cycle
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success-dim)] px-4 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-success)]">Buy</p>
              <p className="text-xl font-bold text-[var(--color-success)]">{result.buyOrdersBelow}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-dim)] px-4 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-danger)]">Sell</p>
              <p className="text-xl font-bold text-[var(--color-danger)]">{result.sellOrdersAbove}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot @ current */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          compact
          label="Equity now"
          value={fmtValue(cur.totalEquity, isCoinM ? 4 : 2)}
          variant="primary"
        />
        <StatCard
          compact
          label="PnL now"
          value={fmtValue(cur.totalPnl, isCoinM ? 4 : 2)}
          variant={cur.totalPnl >= 0 ? "success" : "danger"}
        />
        <StatCard
          compact
          label={`${holdingLabel} held`}
          value={
            isCoinM
              ? formatCoin(cur.coinHeld, coinSymbol, 4)
              : formatNumber(cur.coinHeld, 4)
          }
        />
        <StatCard
          compact
          label="Liq price"
          value={result.liquidationPrice > 0 ? `$${formatNumber(result.liquidationPrice)}` : "—"}
          variant="danger"
        />
      </div>

      {/* Scenario table */}
      <SectionCard title="If price goes to…" subtitle="Equity & position after grid fills" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-4 py-2.5 sm:px-5">Scenario</th>
                <th className="px-4 py-2.5">Price</th>
                <th className="px-4 py-2.5">Equity</th>
                <th className="px-4 py-2.5">PnL</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">{holdingLabel}</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Fills</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--color-border)]/60 last:border-0 ${
                    row.highlight ? "bg-[var(--color-primary-glow)]/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium sm:px-5">{row.label}</td>
                  <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">
                    ${formatNumber(row.price)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">
                    {fmtValue(row.sim.totalEquity, isCoinM ? 4 : 2)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${pnlClass(row.sim.totalPnl)}`}>
                    {fmtValue(row.sim.totalPnl, isCoinM ? 4 : 2)}
                  </td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">
                    {isCoinM
                      ? formatCoin(row.sim.coinHeld, coinSymbol, 4)
                      : formatNumber(row.sim.coinHeld, 4)}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-text-muted)] md:table-cell">
                    {row.sim.filledBuys}B · {row.sim.filledSells}S
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-text-muted)] sm:px-5">
          Simulated from Start Bot → target price · B = buys filled, S = sells filled
        </p>
      </SectionCard>

      {/* Risk + grid meta */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-dim)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">
            Liquidation
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-danger)]">
            {result.liquidationPrice > 0 ? `$${formatNumber(result.liquidationPrice)}` : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {formatPercent(result.distanceToLiqPercent)} from current · at Lower: $
            {formatNumber(result.simulationAtLower.liquidationPrice)}
          </p>
          {addedMargin > 0 && result.liquidationPriceBase > 0 && (
            <p className="mt-2 text-xs text-[var(--color-success)]">
              +{fmtValue(addedMargin, isCoinM ? 4 : 2)} margin → liq $
              {formatNumber(result.liquidationPrice)}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Grid setup
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-muted)]">Spacing</dt>
              <dd className="font-semibold">{formatPercent(result.spacingPercent)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-muted)]">Per grid</dt>
              <dd className="font-semibold">
                {isCoinM && result.coinMeta
                  ? formatUsd(result.coinMeta.quotePerGridUsd, 0)
                  : formatUsd(result.quotePerGrid)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-muted)]">Margin</dt>
              <dd className="font-semibold">
                {isCoinM
                  ? formatCoin(result.marginCollateral, coinSymbol, 4)
                  : formatUsd(result.investment)}
              </dd>
            </div>
            {isCoinM && result.coinMeta && (
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-muted)]">Open position</dt>
                <dd className="font-semibold">
                  {formatCoin(result.coinMeta.openValueBtc, coinSymbol, 4)} (
                  {formatPercent(result.coinMeta.deployRatio * 100, 0)})
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
