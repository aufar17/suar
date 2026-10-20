"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" };
export const GRID_STROKE = "var(--chart-grid)";

/** Recharts animations: short, and off for reduced-motion users. */
export function useChartAnimation() {
  const reduce = useReducedMotion();
  return { isAnimationActive: !reduce, animationDuration: 300, animationEasing: "ease-out" as const };
}

/** Tooltip card in theme colors. Values use text ink; a swatch carries series identity. */
export function ChartTooltipCard({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { key: string; label: ReactNode; value: string; color: string; dashed?: boolean }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-float)]">
      <p className="mb-1.5 font-medium">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block w-3 border-t-2"
              style={{ borderColor: row.color, borderStyle: row.dashed ? "dashed" : "solid" }}
            />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto pl-4 font-mono tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Collapsible data table: the accessible alternative to every chart. */
export function ChartTable({
  caption,
  header,
  rows,
  className,
}: {
  caption: string;
  header: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <Collapsible className={cn("mt-3 text-sm", className)}>
      <CollapsibleTrigger className="group inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:min-h-11">
        <Table2 aria-hidden="true" className="size-3.5" />
        Lihat tabel data
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                {header.map((h, i) => (
                  <th key={h} scope="col" className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t">
                  {row.map((cell, i) => (
                    <td key={i} className={cn("px-3 py-1.5", i > 0 && "text-right font-mono tabular-nums")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
