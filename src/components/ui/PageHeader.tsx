import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">{description}</p>
      {children}
    </div>
  );
}
