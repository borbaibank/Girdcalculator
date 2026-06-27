interface PriceRangeBarProps {
  lower: number;
  upper: number;
  current: number;
  start?: number;
  priceLevels?: number[];
}

function markerPct(price: number, lower: number, range: number): number {
  if (range <= 0) return 50;
  return Math.min(100, Math.max(0, ((price - lower) / range) * 100));
}

export function PriceRangeBar({
  lower,
  upper,
  current,
  start,
  priceLevels = [],
}: PriceRangeBarProps) {
  const range = upper - lower;
  const currentPct = markerPct(current, lower, range);
  const startPrice = start ?? current;
  const startPct = markerPct(startPrice, lower, range);
  const sameMarker = Math.abs(startPrice - current) < 0.0001;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[var(--color-danger)]">{lower.toLocaleString()}</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!sameMarker && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/25">
              Start {startPrice.toLocaleString()}
            </span>
          )}
          <span className="rounded-full bg-[var(--color-primary-glow)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20">
            {sameMarker ? "Start / Current" : "Current"} {current.toLocaleString()}
          </span>
        </div>
        <span className="font-medium text-[var(--color-success)]">{upper.toLocaleString()}</span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-[var(--color-surface-elevated)] ring-1 ring-[var(--color-border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--color-danger)]/30 via-[var(--color-primary)]/20 to-[var(--color-success)]/30"
          style={{ width: "100%" }}
        />
        {priceLevels.map((price, i) => {
          const pct = markerPct(price, lower, range);
          if (pct <= 0 || pct >= 100) return null;
          return (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-white/10"
              style={{ left: `${pct}%` }}
            />
          );
        })}
        {!sameMarker && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 bg-[#0b0e11] shadow-[0_0_10px_rgba(251,191,36,0.45)]"
            style={{ left: `${startPct}%` }}
            title={`Start Bot @ ${startPrice}`}
          />
        )}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-primary)] bg-[#0b0e11] shadow-[0_0_12px_rgba(240,185,11,0.5)]"
          style={{ left: `${currentPct}%` }}
          title={`Current @ ${current}`}
        />
      </div>

      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>Lower</span>
        <span>Price Range</span>
        <span>Upper</span>
      </div>
    </div>
  );
}
