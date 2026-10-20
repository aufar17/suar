"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatInteger, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthlyTrend } from "@/types";
import { AXIS_TICK, ChartTable, ChartTooltipCard, GRID_STROKE, useChartAnimation } from "./chart-parts";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * Color (and dash) follow the year's offset from the current year, never its rank, so
 * hiding a series never repaints the others. Two years back is dashed as a second cue.
 */
function yearStyle(offset: number) {
  if (offset === 0) return { color: "var(--chart-year-current)", width: 3, dash: undefined };
  if (offset === 1) return { color: "var(--chart-year-1)", width: 2, dash: undefined };
  return { color: "var(--chart-year-2)", width: 2, dash: "5 4" };
}

/** One line per year over Jan–Dec, with a legend that toggles series. */
export default function YearComparisonChart({
  data,
  currentYear,
  height = 300,
}: {
  data: MonthlyTrend[];
  currentYear: number;
  height?: number;
}) {
  const animation = useChartAnimation();
  const [hidden, setHidden] = useState<number[]>([]);
  const years = [...new Set(data.map((d) => Number(d.bulan.slice(0, 4))))].sort((a, b) => a - b);
  const byKey = new Map(data.map((d) => [d.bulan, d.jumlah_hotspot]));
  const rows = MONTHS.map((month) => {
    const row: Record<string, number | string | null> = { bulan: month };
    for (const year of years) row[String(year)] = byKey.get(`${year}-${month}`) ?? null;
    return row;
  });
  const config = Object.fromEntries(
    years.map((year) => [String(year), { label: String(year), color: yearStyle(currentYear - year).color }]),
  ) satisfies ChartConfig;

  const toggle = (year: number) =>
    setHidden((current) => (current.includes(year) ? current.filter((y) => y !== year) : [...current, year]));

  return (
    <div>
      <div role="group" aria-label="Tampilkan atau sembunyikan tahun" className="mb-3 flex flex-wrap gap-1.5">
        {years.map((year) => {
          const style = yearStyle(currentYear - year);
          const visible = !hidden.includes(year);
          return (
            <button
              key={year}
              type="button"
              aria-pressed={visible}
              onClick={() => toggle(year)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-[opacity,background-color] duration-150 hover:bg-muted pointer-coarse:h-11",
                !visible && "opacity-50",
              )}
            >
              <span
                aria-hidden="true"
                className="inline-block w-4"
                style={{ borderTop: `${style.width}px ${style.dash ? "dashed" : "solid"} ${style.color}` }}
              />
              <span className={cn("font-mono tabular-nums", year === currentYear && "font-semibold", !visible && "line-through")}>
                {year}
              </span>
              {year === currentYear ? <span className="text-muted-foreground">tahun berjalan</span> : null}
            </button>
          );
        })}
      </div>
      <div role="img" aria-label={`Grafik garis jumlah hotspot per bulan untuk tahun ${years.join(", ")}. Detail ada di tabel data.`}>
        <ChartContainer config={config} className="aspect-auto w-full" style={{ height }} initialDimension={{ width: 720, height }}>
          <LineChart accessibilityLayer={false} data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="bulan"
              tickFormatter={(m: string) => formatMonth(`2000-${m}`, false)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
              tickMargin={8}
            />
            <YAxis tickFormatter={(v: number) => formatInteger(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <ChartTooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={formatMonth(`2000-${String(label)}`, false)}
                    rows={payload
                      .filter((item) => item.value !== null && item.value !== undefined)
                      .map((item) => {
                        const year = Number(item.dataKey);
                        const style = yearStyle(currentYear - year);
                        return {
                          key: String(year),
                          label: String(year),
                          value: formatInteger(Number(item.value)),
                          color: style.color,
                          dashed: Boolean(style.dash),
                        };
                      })}
                  />
                ) : null
              }
            />
            {years.map((year) => {
              const style = yearStyle(currentYear - year);
              return (
                <Line
                  key={year}
                  type="linear"
                  dataKey={String(year)}
                  name={String(year)}
                  hide={hidden.includes(year)}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  dot={false}
                  activeDot={{ r: year === currentYear ? 5 : 4, stroke: "var(--card)", strokeWidth: 2, fill: style.color }}
                  connectNulls={false}
                  {...animation}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
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
