import { clsx } from "clsx";
import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/controls";

export interface SummaryItem {
  label: string;
  value: ReactNode | undefined;
  hint?: ReactNode;
  /** Set to false for text values such as region names. */
  mono?: boolean;
}

/** Row of summary tiles. `undefined` values render a skeleton while data loads. */
export function SummaryCards({ items, className, compact }: { items: SummaryItem[]; className?: string; compact?: boolean }) {
  return (
    <div className={clsx("grid gap-3 xl:gap-4", compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <StatCard
          key={item.label}
          label={item.label}
          compact={compact}
          mono={item.mono}
          value={item.value === undefined ? <Skeleton className="mt-1 h-7 w-20" /> : item.value}
          hint={item.hint}
        />
      ))}
    </div>
  );
}
