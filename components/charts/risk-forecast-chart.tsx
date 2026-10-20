import { clsx } from "clsx";
import { formatDateLong, formatDayShort, formatDecimal } from "@/lib/format";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";
import type { RiskLevel } from "@/types";
import { ChartTable } from "./chart-parts";

const BAR_CLASSES: Record<RiskLevel, string> = {
  rendah: "bg-risk-rendah ring-1 ring-inset ring-border",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/** Columns of the mean risk score for the next 7 days, colored and labelled by level. */
export function RiskForecastChart({ days }: { days: { date: string; score: number }[] }) {
  const summary = days
    .map((d) => `${formatDayShort(d.date)} ${formatDecimal(d.score)} (${getRiskLabel(getRiskLevel(d.score))})`)
    .join("; ");
  return (
    <div>
      <div role="img" aria-label={`Rata-rata skor risiko 7 hari ke depan: ${summary}.`} className="flex gap-2 pt-5">
        {/* Y axis */}
        <div aria-hidden="true" className="relative h-44 w-8 shrink-0">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 font-mono text-[11px] text-muted-foreground"
              style={{ bottom: `${tick * 100}%` }}
            >
              {formatDecimal(tick)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {/* Plot: grid lines and bars share the same box, so heights line up with the axis. */}
          <div className="relative h-44">
            {TICKS.map((tick) => (
              <span
                key={tick}
                aria-hidden="true"
                className={clsx("absolute inset-x-0 h-px", tick === 0 ? "bg-border" : "bg-[var(--chart-grid)]")}
                style={{ bottom: `${tick * 100}%` }}
              />
            ))}
            <ol className="absolute inset-0 grid grid-cols-7 gap-1.5 sm:gap-3">
              {days.map((day) => {
                const level = getRiskLevel(day.score);
                const height = Math.max(1.5, day.score * 100);
                return (
                  <li key={day.date} className="relative flex h-full items-end justify-center">
                    <span
                      className="absolute font-mono text-[11px] font-medium text-foreground sm:text-xs"
                      style={{ bottom: `calc(${height}% + 4px)` }}
                    >
                      {formatDecimal(day.score)}
                    </span>
                    <span
                      title={`${formatDateLong(day.date)}: ${formatDecimal(day.score)}, ${getRiskLabel(level)}`}
                      className={clsx("w-full max-w-10 rounded-t-[4px]", BAR_CLASSES[level])}
                      style={{ height: `${height}%` }}
                    />
                  </li>
                );
              })}
            </ol>
          </div>
          <ol aria-hidden="true" className="mt-1.5 grid grid-cols-7 gap-1.5 sm:gap-3">
            {days.map((day) => {
              const [weekday, date] = formatDayShort(day.date).split(", ");
              return (
                <li key={day.date} className="text-center text-[11px] leading-tight">
                  <span className="block text-foreground">{weekday}</span>
                  <span className="block text-muted-foreground">{date}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground sm:text-[11px]">
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
