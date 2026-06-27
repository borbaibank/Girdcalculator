"use client";

import { useEffect, useMemo, useState } from "react";
import { InputField, ToggleGroup } from "@/components/ui/FormFields";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { PriceRangeBar } from "@/components/grid/PriceRangeBar";
import { SimulationPanel } from "@/components/grid/SimulationPanel";
import { calculateGrid, formatProfitPerGridRange } from "@/lib/calculators/grid";
import { loadGridSettings, saveGridSettings } from "@/lib/grid-settings-storage";
import { formatNumber, formatPercent, formatUsd } from "@/lib/utils/format";
import type { Direction, GridType } from "@/types/calculator";

export function GridCalculator() {
  const [upperPrice, setUpperPrice] = useState(() => loadGridSettings()?.upperPrice ?? "120000");
  const [lowerPrice, setLowerPrice] = useState(() => loadGridSettings()?.lowerPrice ?? "40000");
  const [currentPrice, setCurrentPrice] = useState(() => loadGridSettings()?.currentPrice ?? "60000");
  const [startBotPrice, setStartBotPrice] = useState(() => loadGridSettings()?.startBotPrice ?? "");
  const [gridCount, setGridCount] = useState(() => loadGridSettings()?.gridCount ?? "200");
  const [margin, setMargin] = useState(() => loadGridSettings()?.margin ?? "200");
  const [addedMargin, setAddedMargin] = useState(() => loadGridSettings()?.addedMargin ?? "0");
  const [feePercent, setFeePercent] = useState(() => loadGridSettings()?.feePercent ?? "0.05");
  const [leverage, setLeverage] = useState(() => loadGridSettings()?.leverage ?? "5");
  const [maintenanceMargin, setMaintenanceMargin] = useState(
    () => loadGridSettings()?.maintenanceMargin ?? "0.4",
  );
  const [direction, setDirection] = useState<Direction>(
    () => loadGridSettings()?.direction ?? "neutral",
  );
  const [gridType, setGridType] = useState<GridType>(
    () => loadGridSettings()?.gridType ?? "arithmetic",
  );
  const [activeTable, setActiveTable] = useState<"orders" | "grid">("orders");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveGridSettings({
      upperPrice,
      lowerPrice,
      currentPrice,
      startBotPrice,
      gridCount,
      margin,
      addedMargin,
      feePercent,
      leverage,
      maintenanceMargin,
      direction,
      gridType,
    });
  }, [
    hydrated,
    upperPrice,
    lowerPrice,
    currentPrice,
    startBotPrice,
    gridCount,
    margin,
    addedMargin,
    feePercent,
    leverage,
    maintenanceMargin,
    direction,
    gridType,
  ]);

  useEffect(() => {
    if (!hydrated || loadGridSettings()?.currentPrice) return;
    let cancelled = false;
    fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT")
      .then((res) => res.json())
      .then((data: { price?: string }) => {
        if (cancelled || !data.price) return;
        const price = Math.round(parseFloat(data.price));
        if (Number.isFinite(price)) setCurrentPrice(String(price));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const parsed = useMemo(() => {
    const upper = parseFloat(upperPrice);
    const lower = parseFloat(lowerPrice);
    const current = parseFloat(currentPrice);
    const grids = parseInt(gridCount, 10);
    const collateral = parseFloat(margin);
    const extra = parseFloat(addedMargin) || 0;
    const lev = parseFloat(leverage) || 1;
    const startRaw = parseFloat(startBotPrice);
    const invest = collateral * lev;
    return { upper, lower, current, grids, collateral, extra, lev, invest, start: startRaw };
  }, [upperPrice, lowerPrice, currentPrice, gridCount, margin, addedMargin, leverage, startBotPrice]);

  const gridInput = useMemo(() => {
    const { upper, lower, current, grids, collateral, extra, start } = parsed;
    const effectiveStart = Number.isFinite(start) ? start : current;

    if (
      !Number.isFinite(upper) ||
      !Number.isFinite(lower) ||
      !Number.isFinite(current) ||
      !Number.isFinite(grids) ||
      grids < 2 ||
      upper <= lower ||
      collateral <= 0 ||
      effectiveStart < lower ||
      effectiveStart > upper
    ) {
      return null;
    }

    return {
      upperPrice: upper,
      lowerPrice: lower,
      currentPrice: current,
      startBotPrice: effectiveStart,
      gridCount: grids,
      margin: collateral,
      addedMargin: Math.max(0, extra),
      feePercent: parseFloat(feePercent) || 0,
      leverage: parseFloat(leverage) || 1,
      maintenanceMarginPercent: parseFloat(maintenanceMargin) || 0.4,
      direction,
      gridType,
    };
  }, [parsed, feePercent, leverage, maintenanceMargin, direction, gridType]);

  const result = useMemo(
    () => (gridInput ? calculateGrid(gridInput) : null),
    [gridInput],
  );

  const effectiveStart = Number.isFinite(parsed.start) ? parsed.start : parsed.current;
  const startPriceError =
    Number.isFinite(effectiveStart) &&
    Number.isFinite(parsed.lower) &&
    Number.isFinite(parsed.upper) &&
    parsed.upper > parsed.lower &&
    (effectiveStart < parsed.lower || effectiveStart > parsed.upper);

  const addMargin = (amount: number) => {
    const current = parseFloat(addedMargin) || 0;
    setAddedMargin(String(current + amount));
  };
  const priceError =
    Number.isFinite(parsed.current) &&
    Number.isFinite(parsed.lower) &&
    Number.isFinite(parsed.upper) &&
    parsed.upper > parsed.lower &&
    (parsed.current < parsed.lower || parsed.current > parsed.upper);

  const showRange =
    Number.isFinite(parsed.lower) &&
    Number.isFinite(parsed.upper) &&
    Number.isFinite(parsed.current) &&
    parsed.upper > parsed.lower;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center sm:text-left">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
          Grid Trading Calculator
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Plan Your <span className="gradient-text">Grid Bot</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)] sm:mx-0">
          Simulate profit per grid, capital allocation, and buy/sell orders before going live.
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        {/* Sidebar inputs */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card-glass space-y-5">
            <div>
              <h2 className="section-title">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-primary-glow)] text-xs text-[var(--color-primary)]">
                  ⚙
                </span>
                Grid Settings
              </h2>
            </div>

            <ToggleGroup
              label="Grid Mode"
              value={gridType}
              options={[
                { value: "arithmetic", label: "Arithmetic" },
                { value: "geometric", label: "Geometric" },
              ]}
              onChange={(v) => setGridType(v as GridType)}
            />

            <ToggleGroup
              label="Trend"
              value={direction}
              options={[
                { value: "neutral", label: "Neutral" },
                { value: "long", label: "Long" },
                { value: "short", label: "Short" },
              ]}
              onChange={(v) => setDirection(v as Direction)}
            />

            <div className="space-y-4">
              <InputField
                label="Lower"
                type="number"
                prefix="$"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(e.target.value)}
              />
              <InputField
                label="Upper"
                type="number"
                prefix="$"
                value={upperPrice}
                onChange={(e) => setUpperPrice(e.target.value)}
              />
              <InputField
                label="Current"
                type="number"
                prefix="$"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                hint="Current market price + simulation target (if not Start/Upper/Lower)"
              />
              <InputField
                label="Start Bot"
                type="number"
                prefix="$"
                value={startBotPrice}
                onChange={(e) => setStartBotPrice(e.target.value)}
                hint="Empty = use Current · price where the bot starts placing orders"
              />
            </div>

            {showRange && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4">
                <PriceRangeBar
                  lower={parsed.lower}
                  upper={parsed.upper}
                  current={parsed.current}
                  start={effectiveStart}
                  priceLevels={result?.priceLevels}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Grids"
                type="number"
                min={2}
                value={gridCount}
                onChange={(e) => setGridCount(e.target.value)}
              />
              <InputField
                label="Fee %"
                type="number"
                step="0.01"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Leverage"
                type="number"
                min={1}
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
              />
              <InputField
                label="Maint. Margin %"
                type="number"
                step="0.01"
                value={maintenanceMargin}
                onChange={(e) => setMaintenanceMargin(e.target.value)}
              />
            </div>

            <InputField
              label="Margin"
              type="number"
              prefix="$"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              hint={`Investment = Margin × Leverage = ${formatUsd(parsed.invest)}`}
            />

            <div className="space-y-2">
              <InputField
                label="Add Margin"
                type="number"
                prefix="$"
                min={0}
                value={addedMargin}
                onChange={(e) => setAddedMargin(e.target.value)}
                hint="Extra buffer to reduce liquidation risk (not used for grid orders)"
              />
              <div className="flex flex-wrap gap-2">
                {[50, 100, 500].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => addMargin(amount)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              {(parsed.extra > 0 || parsed.collateral > 0) && (
                <p className="text-xs text-[var(--color-success)]">
                  Total wallet {formatUsd(parsed.collateral + parsed.extra)} (Margin + Add Margin)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="min-w-0 space-y-5">
          {result ? (
            <>
              {!result.botStarted && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <p className="font-semibold text-amber-300">Bot not started yet</p>
                  <p className="mt-1 text-[var(--color-text-muted)]">
                    Waiting for price to reach{" "}
                    <span className="font-mono font-semibold text-amber-300">
                      ${formatNumber(result.startBotPrice)}
                    </span>
                    {result.startBotPrice < parsed.current
                      ? " (price must drop to this level)"
                      : result.startBotPrice > parsed.current
                        ? " (price must rise to this level)"
                        : ""}
                    · All orders are pending
                  </p>
                </div>
              )}

              {/* Hero stat */}
              <div className="card-highlight">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="label mb-2">Profit / Grid (Fee Deducted)</p>
                    <p className="text-4xl font-bold tracking-tight gradient-text sm:text-5xl">
                      {formatProfitPerGridRange(
                        result.netProfitPercentMin,
                        result.netProfitPercentMax,
                        gridType,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                      {formatUsd(result.profitPerGridMin)} – {formatUsd(result.profitPerGridMax)}{" "}
                      <span className="text-[var(--color-text-muted)]/60">per cycle</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success-dim)] px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-[var(--color-success)]">
                        Buy{direction === "long" ? " Below" : direction === "short" ? " Pending" : ""}
                      </p>
                      <p className="text-2xl font-bold text-[var(--color-success)]">
                        {result.buyOrdersBelow}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-dim)] px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-[var(--color-danger)]">
                        Sell{direction === "long" ? " Pending" : direction === "short" ? " Above" : ""}
                      </p>
                      <p className="text-2xl font-bold text-[var(--color-danger)]">
                        {result.sellOrdersAbove}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Margin & Risk */}
              <SectionCard title="Margin & Liquidation" subtitle="Current status" noPadding>
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                  <StatCard
                    compact
                    label="Margin Used"
                    value={formatUsd(result.margin.marginUsed)}
                  />
                  <StatCard
                    compact
                    label="Free Margin"
                    value={formatUsd(result.margin.freeMargin)}
                    variant="success"
                  />
                  <StatCard
                    compact
                    label="Margin Ratio"
                    value={formatPercent(result.margin.marginRatio)}
                  />
                  <StatCard
                    compact
                    label="Position Notional"
                    value={formatUsd(result.margin.positionNotional)}
                  />
                </div>
                <div className="grid gap-3 border-t border-[var(--color-border)] p-5 sm:grid-cols-2 sm:p-6">
                  <div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-dim)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">
                      Liq Price (current)
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-danger)]">
                      {result.liquidationPrice > 0
                        ? `$${formatNumber(result.liquidationPrice)}`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {formatPercent(result.distanceToLiqPercent)} away from current price
                    </p>
                    {parsed.extra > 0 && result.liquidationPriceBase > 0 && (
                      <p className="mt-2 text-xs text-[var(--color-success)]">
                        Before Add Margin: ${formatNumber(result.liquidationPriceBase)} → after +{" "}
                        {formatUsd(parsed.extra)}: ${formatNumber(result.liquidationPrice)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      If price drops to Lower
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                      Liq ${formatNumber(result.simulationAtLower.liquidationPrice)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Total PnL {formatUsd(result.simulationAtLower.totalPnl)} · Coin{" "}
                      {formatNumber(result.simulationAtLower.coinHeld, 4)}
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* Coin holdings simulation */}
              <SectionCard
                title="Coin Holdings by Price"
                subtitle="Simulated from Start Bot Price → target price"
                noPadding
              >
                <div className="space-y-4 p-5 sm:p-6">
                  <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    Price rises → grid sells gradually → coin drops toward zero at Upper · Price
                    falls → grid buys gradually → coin increases at Lower
                  </p>
                  <SimulationPanel
                    title="@ Start Bot Price"
                    subtitle="Coin held when the bot starts placing orders"
                    sim={result.simulationAtStart}
                    investment={result.totalWallet}
                    coinLabel="Coin @ Start"
                    emphasizeCoin
                  />
                  <SimulationPanel
                    title="@ Upper Price"
                    subtitle="Price at top of range → sell grids fill → coin sold out"
                    sim={result.simulationAtUpper}
                    investment={result.totalWallet}
                  />
                  <SimulationPanel
                    title="@ Lower Price"
                    subtitle="Price at bottom of range → buy grids fill → more coin accumulated"
                    sim={result.simulationAtLower}
                    investment={result.totalWallet}
                  />
                  <SimulationPanel
                    title="@ Current Price"
                    subtitle="Simulated from Start Bot → entered price (Current)"
                    sim={result.simulationAtCurrent}
                    investment={result.totalWallet}
                    coinLabel="Coin @ Current"
                    emphasizeCoin
                  />
                </div>
              </SectionCard>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard compact label="Spacing" value={formatUsd(result.spacing)} />
                <StatCard compact label="Spacing %" value={formatPercent(result.spacingPercent)} />
                <StatCard compact label="/ Grid" value={formatUsd(result.quotePerGrid)} />
                <StatCard
                  compact
                  label="Investment"
                  value={formatUsd(result.investment)}
                  variant="primary"
                />
                <StatCard
                  compact
                  label="Coin @ Start"
                  value={formatNumber(result.holdingsAtStart.coin, 4)}
                />
                <StatCard compact label="USDT @ Start" value={formatUsd(result.holdingsAtStart.usdt)} />
                <StatCard
                  compact
                  label="Coin @ Current"
                  value={formatNumber(result.simulationAtCurrent.coinHeld, 4)}
                  variant="primary"
                />
                <StatCard
                  compact
                  label="USDT @ Current"
                  value={formatUsd(result.simulationAtCurrent.usdtBalance)}
                />
                <StatCard
                  compact
                  label="Position"
                  value={formatUsd(result.totalPosition)}
                  variant="primary"
                />
              </div>
            </>
          ) : (
            <div className="card-glass flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-glow)] ring-1 ring-[var(--color-primary)]/20">
                <svg
                  className="h-8 w-8 text-[var(--color-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold text-[var(--color-text)]">
                {priceError
                  ? "Current price is out of range"
                  : startPriceError
                    ? "Start Bot Price is out of range"
                    : "Enter values to start calculating"}
              </p>
              <p className="mt-2 max-w-xs text-sm text-[var(--color-text-muted)]">
                {priceError
                  ? "Current Price must be between Lower and Upper Price"
                  : startPriceError
                    ? "Start Bot Price must be between Lower and Upper Price"
                    : "Set price range, grids, and margin on the left"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tables — full width, tabbed */}
      {result && (
        <SectionCard
          title="Details"
          subtitle={`${result.orders.length} orders · ${result.cells.length} grids`}
          noPadding
        >
          <div className="flex gap-1 border-b border-[var(--color-border)] px-4 pt-3 sm:px-5">
            {(
              [
                { id: "orders" as const, label: "Orders" },
                { id: "grid" as const, label: "Grid Table" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTable(tab.id)}
                className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTable === tab.id
                    ? "bg-[var(--color-surface-elevated)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-[280px] overflow-auto">
            {activeTable === "orders" ? (
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="table-head">
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="hidden px-4 py-2.5 sm:table-cell">Qty</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="hidden px-4 py-2.5 md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orders.map((order, idx) => (
                    <tr key={`${order.type}-${order.price}-${idx}`} className="table-row">
                      <td className="px-4 py-2.5">
                        <span className={order.type === "buy" ? "badge-buy" : "badge-sell"}>
                          {order.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono">{formatNumber(order.price)}</td>
                      <td className="hidden px-4 py-2.5 font-mono text-[var(--color-text-muted)] sm:table-cell">
                        {formatNumber(order.quantity, 4)}
                      </td>
                      <td className="px-4 py-2.5">{formatUsd(order.quoteAmount)}</td>
                      <td className="hidden px-4 py-2.5 md:table-cell">
                        <span className="badge-neutral">{order.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="table-head">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Buy</th>
                    <th className="px-4 py-2.5">Sell</th>
                    <th className="hidden px-4 py-2.5 sm:table-cell">Qty</th>
                    <th className="px-4 py-2.5">Profit</th>
                    <th className="hidden px-4 py-2.5 md:table-cell">Net %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cells.map((cell) => (
                    <tr
                      key={cell.level}
                      className={`table-row ${cell.zone === "current" ? "bg-[var(--color-primary-glow)]" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{cell.level}</td>
                      <td className="px-4 py-2.5 font-mono text-[var(--color-success)]">
                        {formatNumber(cell.buyPrice)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[var(--color-danger)]">
                        {formatNumber(cell.sellPrice)}
                      </td>
                      <td className="hidden px-4 py-2.5 font-mono text-[var(--color-text-muted)] sm:table-cell">
                        {formatNumber(cell.quantity, 4)}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-semibold ${cell.netProfit >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
                      >
                        {formatUsd(cell.netProfit)}
                      </td>
                      <td
                        className={`hidden px-4 py-2.5 md:table-cell ${cell.netProfitPercent >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
                      >
                        {formatPercent(cell.netProfitPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
