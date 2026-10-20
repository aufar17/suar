"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInteger, formatMonth } from "@/lib/format";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltip, GRID_STROKE } from "./chart-parts";

/** Hotspots per month as bars (single series, named by the card title). */
export function MonthlyBarChart({ data, height = 240, label }: { data: MonthlyTrend[]; height?: number; label: string }) {
  return (
    <div>
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
          <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(v: string) => formatMonth(v, v.endsWith("-01"))}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v: number) => formatInteger(v)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload, label: month }) => (
                <ChartTooltip active={active} payload={payload} title={month ? formatMonth(String(month)) : ""} />
              )}
            />
            <Bar
              dataKey="jumlah_hotspot"
              name="Hotspot"
              fill="var(--chart-line)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Jumlah hotspot per bulan"
        header={["Bulan", "Jumlah hotspot"]}
        rows={data.map((d) => [formatMonth(d.bulan), formatInteger(d.jumlah_hotspot)])}
      />
    </div>
  );
}
