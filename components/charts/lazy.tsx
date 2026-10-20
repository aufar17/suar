"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Chart placeholder with the chart's own footprint (plot + table toggle), so nothing shifts on load. */
export function ChartSkeleton({ height = 300, legend = false }: { height?: number; legend?: boolean }) {
  return (
    <div role="status" aria-label="Memuat grafik">
      {legend ? (
        <div className="mb-3 flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full pointer-coarse:h-11" />
          ))}
        </div>
      ) : null}
      <div className="flex gap-3" style={{ height }}>
        <div className="flex w-9 flex-col justify-between py-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-2.5 w-7" />
          ))}
        </div>
        <Skeleton className="flex-1 rounded-lg opacity-60" />
      </div>
      <Skeleton className="mt-3 h-9 w-32 pointer-coarse:h-11" />
    </div>
  );
}

// Recharts is heavy; charts load on the client after the page shell.
export const MonthlyTrendChart = dynamic(() => import("./monthly-trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const YearComparisonChart = dynamic(() => import("./year-comparison-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton legend />,
});

export const MonthlyBarChart = dynamic(() => import("./monthly-bar-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
});
