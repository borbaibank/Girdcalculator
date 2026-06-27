import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  prefix?: string;
}

export function InputField({
  label,
  hint,
  prefix,
  id,
  className = "",
  ...props
}: InputFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      {prefix ? (
        <div className="flex items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] transition-all duration-200 focus-within:border-[rgba(240,185,11,0.5)] focus-within:shadow-[0_0_0_3px_rgba(240,185,11,0.1)]">
          <span className="shrink-0 border-r border-[var(--color-border)] px-3 py-3 text-sm font-medium text-[var(--color-text-muted)]">
            {prefix}
          </span>
          <input
            id={inputId}
            className={`min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[var(--color-text)] outline-none ${className}`}
            {...props}
          />
        </div>
      ) : (
        <input id={inputId} className={`input-field ${className}`} {...props} />
      )}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]/80">{hint}</p>}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export function SelectField({ label, options, id, className = "", ...props }: SelectFieldProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="min-w-0">
      <label htmlFor={selectId} className="label">
        {label}
      </label>
      <select id={selectId} className={`input-field ${className}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ToggleGroupProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function ToggleGroup({ label, value, options, onChange }: ToggleGroupProps) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all duration-200 sm:px-3 sm:text-sm ${
                active
                  ? "bg-[var(--color-primary)] text-[#0b0e11] shadow-[0_2px_12px_rgba(240,185,11,0.3)]"
                  : "text-[var(--color-text-muted)] hover:bg-white/[0.04] hover:text-[var(--color-text)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
