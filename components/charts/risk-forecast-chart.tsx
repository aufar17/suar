"use client";

import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateLong, formatDayShort, formatDecimal } from "@/lib/format";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { ChartTable } from "./chart-parts";

const BAR_CLASSES: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/35",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Mean risk score for the next 7 days as columns, colored and labelled by level.
 * HTML/CSS rather than Recharts so the level text sits under every bar. Bars grow in
 * one after another; each has a hover/focus tooltip with the full date.
 */
export function RiskForecastChart({ days }: { days: { date: string; score: number }[] }) {
  const summary = days
    .map((d) => `${formatDayShort(d.date)} ${formatDecimal(d.score)} (${getRiskLabel(getRiskLevel(d.score))})`)
    .join("; ");
  return (
    <div>
      <div className="flex gap-2 pt-5">
        {/* Y axis */}
        <div aria-hidden="true" className="relative h-48 w-8 shrink-0">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 font-mono text-[11px] text-muted-foreground tabular-nums"
              style={{ bottom: `${tick * 100}%` }}
            >
              {tick === 0 || tick === 1 ? tick : formatDecimal(tick)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48" role="img" aria-label={`Rata-rata skor risiko 7 hari ke depan: ${summary}.`}>
            {TICKS.map((tick) => (
              <span
                key={tick}
                aria-hidden="true"
                className={cn("absolute inset-x-0 h-px", tick === 0 ? "bg-border" : "bg-[var(--chart-grid)]")}
                style={{ bottom: `${tick * 100}%` }}
              />
            ))}
            <ol className="absolute inset-0 grid grid-cols-7 gap-1.5 sm:gap-3">
              {days.map((day, index) => {
                const level = getRiskLevel(day.score);
                const height = Math.max(1.5, day.score * 100);
                return (
                  <li key={day.date} className="relative flex h-full items-end justify-center">
                    <span
                      className="absolute font-mono text-[11px] font-medium tabular-nums sm:text-xs"
                      style={{ bottom: `calc(${height}% + 4px)` }}
                    >
                      {formatDecimal(day.score)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.span
                          tabIndex={-1}
                          className={cn("block w-full max-w-11 origin-bottom rounded-t-[4px]", BAR_CLASSES[level])}
                          style={{ height: `${height}%` }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.04, ease: [0.2, 0, 0, 1] }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateLong(day.date)} · skor {formatDecimal(day.score)} · {getRiskLabel(level)}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ol>
          </div>
          <ol aria-hidden="true" className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-3">
            {days.map((day) => {
              const [weekday, date] = formatDayShort(day.date).split(", ");
              return (
                <li key={day.date} className="text-center text-[11px] leading-tight">
                  <span className="block font-medium">{weekday}</span>
                  <span className="block text-muted-foreground">{date}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground sm:text-[11px]">
                    {getRiskLabel(getRiskLevel(day.score))}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <ChartTable
        caption="Prediksi rata-rata skor risiko 7 hari"
        header={["Tanggal", "Skor", "Level"]}
        rows={days.map((d) => [formatDayShort(d.date), formatDecimal(d.score), getRiskLabel(getRiskLevel(d.score))])}
      />
    </div>
  );
}
