import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bento KPI tile: label, big value, a supporting line, and an optional figure
 * (sparkline, meter) pinned to the bottom. Server-renderable.
 */
export function StatTile({
  label,
  icon: Icon,
  value,
  unit,
  hint,
  figure,
  className,
  size = "md",
  mono = true,
}: {
  label: string;
  icon?: LucideIcon;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  figure?: ReactNode;
  className?: string;
  size?: "md" | "lg";
  /** Numbers use the mono face; names and months do not. */
  mono?: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={cn("flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
        {label}
      </p>
      <p
        className={cn(
          "truncate font-semibold tracking-tight",
          mono && "font-mono",
          size === "lg" ? "mt-1 text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
        )}
      >
        {value}
        {unit ? <span className="ml-1.5 font-sans text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      {figure ? <div className="mt-auto pt-3">{figure}</div> : null}
    </section>
  );
}
