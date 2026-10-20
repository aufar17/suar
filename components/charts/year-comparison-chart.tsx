"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInteger, formatMonth } from "@/lib/format";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltip, GRID_STROKE } from "./chart-parts";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/** Color follows the year's position relative to the current year, never its rank. */
function yearColor(offset: number): string {
  if (offset === 0) return "var(--chart-year-current)";
  if (offset === 1) return "var(--chart-year-1)";
  return "var(--chart-year-2)";
}

/** One line per year over Jan–Dec; the current year is thicker and uses the accent. */
export function YearComparisonChart({
  data,
  currentYear,
  height = 280,
}: {
  data: MonthlyTrend[];
  currentYear: number;
  height?: number;
}) {
  const years = [...new Set(data.map((d) => Number(d.bulan.slice(0, 4))))].sort((a, b) => a - b);
  const byKey = new Map(data.map((d) => [d.bulan, d.jumlah_hotspot]));
  const rows = MONTHS.map((month) => {
    const row: Record<string, number | string | null> = { bulan: month };
    for (const year of years) row[String(year)] = byKey.get(`${year}-${month}`) ?? null;
    return row;
  });

  const ariaLabel = `Grafik perbandingan jumlah hotspot per bulan untuk tahun ${years.join(", ")}. Detail ada di tabel data.`;

  return (
    <div>
      <ul aria-label="Legenda tahun" className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg">
        {years.map((year) => (
          <li key={year} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-4 rounded-full"
              style={{ height: year === currentYear ? 4 : 2, background: yearColor(currentYear - year) }}
            />
            <span className={year === currentYear ? "font-semibold" : undefined}>
              {year}
              {year === currentYear ? " (tahun berjalan)" : ""}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height }}>
          <LineChart accessibilityLayer={false} data={rows} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(m: string) => formatMonth(`2000-${m}`, false)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              interval="preserveStartEnd"
              minTickGap={8}
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
                <ChartTooltip
                  active={active}
                  payload={payload}
                  title={label ? formatMonth(`2000-${String(label)}`, false) : ""}
                />
              )}
            />
            {years.map((year) => {
              const current = year === currentYear;
              return (
                <Line
                  key={year}
                  type="linear"
                  dataKey={String(year)}
                  name={String(year)}
                  stroke={yearColor(currentYear - year)}
                  strokeWidth={current ? 3.5 : 2}
                  strokeOpacity={current ? 1 : 0.85}
                  dot={false}
                  activeDot={{ r: current ? 5 : 4, stroke: "var(--surface)", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                  label={(props: { index?: number; x?: number | string; y?: number | string; value?: unknown }) => {
                    // Direct label only for the current year; the legend names the others.
                    const last = rows.findLastIndex((r) => r[String(year)] !== null);
                    if (!current || props.index !== last || props.x === undefined || props.y === undefined) return <g />;
                    return (
                      <text
                        x={Number(props.x) + 6}
                        y={Number(props.y) + 4}
                        fontSize={11}
                        fontFamily="var(--font-mono)"
                        fontWeight={current ? 600 : 400}
                        fill="var(--fg)"
                      >
                        {year}
                      </text>
                    );
                  }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Jumlah hotspot per bulan per tahun"
        header={["Bulan", ...years.map(String)]}
        rows={rows.map((row) => [
          formatMonth(`2000-${String(row.bulan)}`, false),
          ...years.map((y) => (row[String(y)] === null ? "–" : formatInteger(Number(row[String(y)])))),
        ])}
      />
    </div>
  );
}
