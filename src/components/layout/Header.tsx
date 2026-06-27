import Link from "next/link";

function GridIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="2" fill="#F0B90B" fillOpacity="0.9" />
      <rect x="16" y="2" width="10" height="10" rx="2" fill="#F0B90B" fillOpacity="0.5" />
      <rect x="2" y="16" width="10" height="10" rx="2" fill="#F0B90B" fillOpacity="0.5" />
      <rect x="16" y="16" width="10" height="10" rx="2" fill="#F0B90B" fillOpacity="0.3" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[#080a0d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <div className="rounded-xl bg-[var(--color-primary-glow)] p-1.5 ring-1 ring-[var(--color-primary)]/20 transition group-hover:ring-[var(--color-primary)]/40">
            <GridIcon />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight gradient-text">GridCalc</span>
            <p className="text-[10px] font-medium tracking-wide text-[var(--color-text-muted)]">
              Grid Trading Calculator
            </p>
          </div>
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]" />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Spot Grid</span>
        </div>
      </div>
    </header>
  );
}
