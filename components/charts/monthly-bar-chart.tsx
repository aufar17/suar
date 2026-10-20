"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatInteger, formatMonth } from "@/lib/format";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltipCard, GRID_STROKE, useChartAnimation } from "./chart-parts";

const config = { jumlah_hotspot: { label: "Hotspot", color: "var(--chart-1)" } } satisfies ChartConfig;

/**
 * Hotspots per month as bars (single series, named by the card title). Past months are
 * de-emphasized; the latest month carries the accent.
 */
export default function MonthlyBarChart({ data, height = 240, label }: { data: MonthlyTrend[]; height?: number; label: string }) {
  const animation = useChartAnimation();
  const last = data.length - 1;
  return (
    <div>
      <div role="img" aria-label={label}>
        <ChartContainer config={config} className="aspect-auto w-full" style={{ height }} initialDimension={{ width: 640, height }}>
          <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(v: string) => (v.endsWith("-01") ? v.slice(0, 4) : formatMonth(v, false))}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(v: number) => formatInteger(v)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label: month }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={formatMonth(String(month))}
                    rows={[
                      { key: "h", label: "Hotspot", value: formatInteger(Number(payload[0].value)), color: "var(--chart-1)" },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="jumlah_hotspot" radius={[4, 4, 0, 0]} {...animation}>
              {data.map((d, i) => (
                <Cell key={d.bulan} fill={i === last ? "var(--chart-1)" : "var(--muted-foreground)"} fillOpacity={i === last ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      <ChartTable
        caption="Jumlah hotspot per bulan"
        header={["Bulan", "Jumlah hotspot"]}
        rows={data.map((d) => [formatMonth(d.bulan), formatInteger(d.jumlah_hotspot)])}
      />
    </div>
  );
}
