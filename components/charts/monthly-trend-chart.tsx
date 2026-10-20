"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInteger, formatMonth } from "@/lib/format";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltip, GRID_STROKE } from "./chart-parts";

/** Single series: hotspots per month. The card title names it, so there is no legend. */
export function MonthlyTrendChart({
  data,
  height = 280,
  seriesName = "Hotspot",
}: {
  data: MonthlyTrend[];
  height?: number;
  seriesName?: string;
}) {
  const peak = data.reduce<MonthlyTrend | null>((max, d) => (!max || d.jumlah_hotspot > max.jumlah_hotspot ? d : max), null);
  const ariaLabel = peak
    ? `Grafik garis jumlah hotspot per bulan, ${formatMonth(data[0].bulan)} sampai ${formatMonth(data[data.length - 1].bulan)}. Puncak ${formatMonth(peak.bulan)} dengan ${formatInteger(peak.jumlah_hotspot)} hotspot.`
    : "Grafik garis jumlah hotspot per bulan";
  return (
    <div>
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
          <LineChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(v: string) => formatMonth(v, v.endsWith("-01")).replace(" ", " ")}
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
              width={48}
            />
            <Tooltip
              cursor={{ stroke: "var(--fg-muted)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => (
                <ChartTooltip active={active} payload={payload} title={label ? formatMonth(String(label)) : ""} />
              )}
            />
            <Line
              type="linear"
              dataKey="jumlah_hotspot"
              name={seriesName}
              stroke="var(--chart-line)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--chart-line)" }}
              isAnimationActive={false}
            />
          </LineChart>
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
