"use client";

import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatInteger, formatMonth } from "@/lib/format";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltipCard, GRID_STROKE, useChartAnimation } from "./chart-parts";

const config = { jumlah_hotspot: { label: "Hotspot", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Single series: hotspots per month. The card title names it, so there is no legend; the peak is labelled. */
export default function MonthlyTrendChart({ data, height = 300 }: { data: MonthlyTrend[]; height?: number }) {
  const animation = useChartAnimation();
  const peak = data.reduce<MonthlyTrend | null>((max, d) => (!max || d.jumlah_hotspot > max.jumlah_hotspot ? d : max), null);
  const ariaLabel = peak
    ? `Grafik area jumlah hotspot per bulan, ${formatMonth(data[0].bulan)} sampai ${formatMonth(data[data.length - 1].bulan)}. Puncak ${formatMonth(peak.bulan)} dengan ${formatInteger(peak.jumlah_hotspot)} hotspot.`
    : "Grafik area jumlah hotspot per bulan";
  return (
    <div>
      <div role="img" aria-label={ariaLabel}>
        <ChartContainer config={config} className="aspect-auto w-full" style={{ height }} initialDimension={{ width: 720, height }}>
          <AreaChart accessibilityLayer={false} data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-jumlah_hotspot)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-jumlah_hotspot)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(v: string) => (v.endsWith("-01") ? v.slice(0, 4) : formatMonth(v, false))}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
              tickMargin={8}
            />
            <YAxis tickFormatter={(v: number) => formatInteger(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <ChartTooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={formatMonth(String(label))}
                    rows={[
                      {
                        key: "hotspot",
                        label: "Hotspot",
                        value: formatInteger(Number(payload[0].value)),
                        color: "var(--color-jumlah_hotspot)",
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Area
              type="linear"
              dataKey="jumlah_hotspot"
              stroke="var(--color-jumlah_hotspot)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              activeDot={{ r: 4.5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--color-jumlah_hotspot)" }}
              {...animation}
            />
            {peak ? (
              <ReferenceDot
                x={peak.bulan}
                y={peak.jumlah_hotspot}
                r={4}
                fill="var(--color-jumlah_hotspot)"
                stroke="var(--card)"
                strokeWidth={2}
                label={{
                  value: `Puncak ${formatMonth(peak.bulan)}`,
                  position: "top",
                  offset: 10,
                  fill: "var(--foreground)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            ) : null}
          </AreaChart>
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
