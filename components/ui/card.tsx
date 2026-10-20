import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={clsx("rounded-card border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  titleAs: Title = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Title className="text-sm font-semibold text-fg">{title}</Title>
        {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Summary tile: label, big mono value, optional supporting line. */
export function StatCard({
  label,
  value,
  hint,
  className,
  children,
  mono = true,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** Numbers use the mono face; names do not. */
  mono?: boolean;
  compact?: boolean;
}) {
  return (
    <Card className={clsx("flex min-w-0 flex-col gap-1", compact ? "p-3" : "p-4", className)}>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <div
        className={clsx(
          "font-semibold tracking-tight text-fg",
          mono && "font-mono",
          compact ? "text-lg leading-snug break-words" : "truncate text-2xl",
        )}
      >
        {value}
      </div>
      {hint ? <p className={clsx("text-xs text-fg-muted", !compact && "truncate")}>{hint}</p> : null}
      {children}
    </Card>
  );
}
