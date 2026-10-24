"use client";

import type { LucideIcon } from "lucide-react";
import { memo, type ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MapStat {
  label: string;
  icon?: LucideIcon;
  /** Numbers animate between values; text (e.g. a region name) is shown as is. `undefined` = loading. */
  value: number | string | undefined;
  format?: (value: number) => string;
  unit?: string;
  hint?: ReactNode;
  /** Highlight with the ember accent (the most important figure). */
  accent?: boolean;
}

/** Compact stat tiles for the floating map panel (2×2) and the mobile drawer. */
export const MapStats = memo(function MapStats({ items, className }: { items: MapStat[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-background/70 px-3 py-2.5 dark:bg-background/40"
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {item.icon ? (
              <item.icon aria-hidden="true" className={cn("size-3.5 shrink-0", item.accent && "text-ember-ink")} />
            ) : null}
            <span className="truncate">{item.label}</span>
          </dt>
          <dd className="min-w-0">
            {item.value === undefined ? (
              <Skeleton className="my-1 h-6 w-16" />
            ) : typeof item.value === "number" ? (
              <span className="text-xl leading-8 font-semibold tracking-tight">
                <CountUp value={item.value} format={item.format ?? String} className="font-mono tabular-nums" />
                {item.unit ? <span className="ml-1 text-xs font-medium text-muted-foreground">{item.unit}</span> : null}
              </span>
            ) : (
              <span className="block truncate text-base leading-8 font-semibold tracking-tight">{item.value}</span>
            )}
          </dd>
          {item.hint ? <dd className="truncate text-[11px] text-muted-foreground">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
});
