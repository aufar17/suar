import { cn } from "@/lib/utils";

const WIDTH = 100;
const HEIGHT = 32;
const PAD = 3;

/**
 * Tiny trend line (plain SVG, server-rendered, no layout shift). The line is in the
 * de-emphasis ink; the highlighted point (default: the last) is an accent dot drawn in
 * HTML so it stays round while the line stretches to the card width.
 */
export function Sparkline({
  values,
  highlight = values.length - 1,
  className,
  area = false,
}: {
  values: number[];
  /** Index drawn as an accent dot. */
  highlight?: number;
  className?: string;
  area?: boolean;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => (i / (values.length - 1)) * WIDTH;
  const y = (v: number) => PAD + (1 - (v - min) / (max - min || 1)) * (HEIGHT - PAD * 2);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  return (
    <div aria-hidden="true" className={cn("relative h-8 w-full", className)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {area ? <path d={`${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} fill="var(--muted-foreground)" fillOpacity={0.08} /> : null}
        <path
          d={line}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
        style={{ left: `${x(highlight)}%`, top: `${(y(values[highlight]) / HEIGHT) * 100}%` }}
      />
    </div>
  );
}
