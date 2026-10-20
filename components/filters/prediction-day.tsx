"use client";

import { clsx } from "clsx";
import { useId } from "react";
import { PREDICTION_DAYS } from "@/components/map/use-map-filters";
import { addDaysIso, formatDateLong, formatDayShort, formatPercent } from "@/lib/format";

/** Slider for the prediction day (+1 … +7) with the resulting date. */
export function PredictionDaySlider({
  baseDate,
  value,
  onChange,
}: {
  baseDate: string;
  value: number;
  onChange: (day: number) => void;
}) {
  const id = useId();
  const target = addDaysIso(baseDate, value);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-fg-muted">
          Prediksi untuk
        </label>
        <span className="text-sm font-medium text-fg">
          <span className="font-mono">+{value}</span> · {formatDayShort(target)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={7}
        step={1}
        value={value}
        aria-valuetext={`Hari ke-${value}, ${formatDateLong(target)}`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--primary)]"
      />
      <div aria-hidden="true" className="flex justify-between px-0.5 font-mono text-[11px] text-fg-muted">
        {PREDICTION_DAYS.map((day) => (
          <span key={day} className={clsx(day === value && "font-semibold text-fg")}>
            +{day}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mobile: one chip per prediction day. */
export function PredictionDayChips({
  baseDate,
  value,
  onChange,
}: {
  baseDate: string;
  value: number;
  onChange: (day: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Prediksi untuk hari" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {PREDICTION_DAYS.map((day) => {
        const target = addDaysIso(baseDate, day);
        const active = day === value;
        return (
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Hari ke-${day}, ${formatDateLong(target)}`}
            onClick={() => onChange(day)}
            className={clsx(
              "flex min-h-11 min-w-14 shrink-0 flex-col items-center justify-center rounded-lg border px-2 leading-tight",
              active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg",
            )}
          >
            <span className="font-mono text-xs font-semibold">+{day}</span>
            <span className="text-[11px] opacity-80">{formatDayShort(target).replace(",", "")}</span>
          </button>
        );
      })}
    </div>
  );
}

export function OpacitySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-fg-muted">
          Opasitas lapisan risiko
        </label>
        <span className="font-mono text-xs text-fg">{formatPercent(value * 100)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0.2}
        max={1}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--primary)]"
      />
    </div>
  );
}
