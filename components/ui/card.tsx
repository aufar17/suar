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
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={clsx("flex min-w-0 flex-col gap-1 p-4", className)}>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <div className="truncate font-mono text-2xl font-semibold tracking-tight text-fg">{value}</div>
      {hint ? <p className="truncate text-xs text-fg-muted">{hint}</p> : null}
      {children}
    </Card>
  );
}
