"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import { PREDICTION_DAYS } from "@/components/map/use-map-filters";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { addDaysIso, formatDateLong, formatDayShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Prediction timeline: play/pause plus a +1…+7 day slider with dates. The slider handles
 * keyboard input (arrows, Home/End); the day labels are extra click targets for mice.
 */
export const PredictionTimeline = memo(function PredictionTimeline({
  baseDate,
  value,
  onChange,
  playing,
  onPlayingChange,
  loading,
  className,
}: {
  baseDate: string;
  value: number;
  onChange: (day: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  loading?: boolean;
  className?: string;
}) {
  const target = addDaysIso(baseDate, value);
  const pick = (day: number) => {
    onPlayingChange(false);
    onChange(day);
  };
  return (
    <section
      aria-label="Linimasa prediksi risiko"
      className={cn("glass-panel rounded-2xl px-3 pt-2.5 pb-1.5 sm:px-4", className)}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ember"
          size="icon"
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? "Jeda animasi prediksi" : "Putar animasi prediksi 7 hari"}
          aria-pressed={playing}
          className="size-10 shrink-0 rounded-full shadow-sm"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={playing ? "pause" : "play"}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
            </motion.span>
          </AnimatePresence>
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">Prediksi risiko untuk</p>
            {loading ? <Loader2 aria-label="Memuat prediksi" className="size-3.5 animate-spin text-muted-foreground" /> : null}
          </div>
          <p className="truncate text-sm font-semibold">
            <span className="font-mono tabular-nums">+{value}</span> hari · {formatDayShort(target)}
          </p>
        </div>
      </div>

      <div className="mt-2.5 px-[calc(100%/14-10px)]">
        <Slider
          min={1}
          max={7}
          step={1}
          value={[value]}
          onValueChange={([day]) => pick(day)}
          aria-label="Hari prediksi"
          aria-valuetext={`Hari ke-${value}, ${formatDateLong(target)}`}
        />
      </div>
      <ol aria-hidden="true" className="mt-1 grid grid-cols-7">
        {PREDICTION_DAYS.map((day) => {
          const [weekday, date] = formatDayShort(addDaysIso(baseDate, day)).split(", ");
          const active = day === value;
          return (
            <li key={day} className="flex justify-center">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => pick(day)}
                className={cn(
                  "flex min-h-9 flex-col items-center justify-center rounded-md px-1 leading-tight transition-colors duration-150",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("font-mono text-[11px] tabular-nums", active && "font-semibold")}>+{day}</span>
                <span className="hidden text-[10px] sm:block">
                  {weekday} {date.split(" ")[0]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
