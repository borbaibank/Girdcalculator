interface StatCardProps {
  label: string;
  value: string;
  variant?: "default" | "success" | "danger" | "primary";
  compact?: boolean;
}

const variantStyles = {
  default: "text-[var(--color-text)]",
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
  primary: "text-[var(--color-primary)]",
};

const variantBg = {
  default: "",
  success: "border-[var(--color-success)]/10 bg-[var(--color-success-dim)]",
  danger: "border-[var(--color-danger)]/10 bg-[var(--color-danger-dim)]",
  primary: "border-[var(--color-primary)]/15 bg-[var(--color-primary-glow)]",
};

export function StatCard({
  label,
  value,
  variant = "default",
  compact = false,
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 ${variantBg[variant]} ${compact ? "p-3.5" : "p-4"}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold leading-tight ${variantStyles[variant]} ${compact ? "text-base" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}
