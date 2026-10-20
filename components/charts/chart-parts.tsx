"use client";

import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";
import { formatInteger } from "@/lib/format";

export const AXIS_TICK = { fill: "var(--fg-muted)", fontSize: 11, fontFamily: "var(--font-mono)" };
export const GRID_STROKE = "var(--chart-grid)";

/** Tooltip card in theme colors. Values use text ink; a swatch carries series identity. */
export function ChartTooltip({
  active,
  payload,
  title,
}: Pick<TooltipContentProps<number, string>, "active" | "payload"> & { title: ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-sm">
      <p className="mb-1 font-medium">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {payload
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => (
            <li key={String(item.dataKey)} className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="ml-auto pl-3 font-mono">{formatInteger(Number(item.value))}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Collapsible data table: the accessible alternative to every chart. */
export function ChartTable({ caption, header, rows }: { caption: string; header: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-muted-foreground hover:text-foreground">
        Lihat tabel data
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted">
            <tr>
              {header.map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 text-xs font-medium text-muted-foreground ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-border">
                {row.map((cell, i) => (
                  <td key={i} className={`px-3 py-1.5 ${i > 0 ? "text-right font-mono" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
