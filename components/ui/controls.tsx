"use client";

import { clsx } from "clsx";
import { useId, type ReactNode } from "react";

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible label when `label` is not plain text. */
  ariaLabel?: string;
}

/** Radio group rendered as a segmented control. Arrow keys move the selection. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  hideLabel,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  hideLabel?: boolean;
}) {
  const labelId = useId();
  const move = (delta: number) => {
    const index = options.findIndex((o) => o.value === value);
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.value);
  };
  return (
    <div className={className}>
      <p id={labelId} className={clsx("mb-1.5 text-xs font-medium text-fg-muted", hideLabel && "sr-only")}>
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex rounded-[10px] border border-line bg-surface-2 p-1"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.ariaLabel}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={clsx(
                "min-h-11 flex-1 rounded-[7px] px-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-fg" : "text-fg-muted hover:bg-surface hover:text-fg",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-surface-2"
    >
      {icon ? <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">{label}</span>
        {description ? <span className="block text-xs text-fg-muted">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={clsx(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-line",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("animate-pulse rounded-md bg-surface-2", className)} />;
}
