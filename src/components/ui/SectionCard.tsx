import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  children,
  className = "",
  noPadding = false,
}: SectionCardProps) {
  return (
    <div className={`card-glass overflow-hidden ${className}`}>
      <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
      <div className={noPadding ? "" : "p-5 sm:p-6"}>{children}</div>
    </div>
  );
}
