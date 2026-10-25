"use client";

import { ChevronRight, MapPinOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { memo } from "react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/state";
import { formatDecimal } from "@/lib/format";
import { regionHref } from "@/lib/labels";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RegionStat, RiskLevel } from "@/types";

const BAR_CLASSES: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/50",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

/**
 * The five most at-risk regencies/cities (by mean risk score) for the selected target date.
 * `stats` must only hold regions with a prediction (see `hasPrediction`).
 */
export const TopRegions = memo(function TopRegions({
  stats,
  highlight,
  emptyDescription = "Skor risiko untuk tanggal ini belum tersedia.",
  error,
  onRetry,
  className,
}: {
  stats: RegionStat[] | undefined;
  /** Slug marked as the current region. */
  highlight?: string | null;
  emptyDescription?: string;
  error?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (error) {
    return (
      <p role="alert" className={cn("text-sm text-muted-foreground", className)}>
        Gagal memuat peringkat.{" "}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="font-medium text-foreground underline underline-offset-2">
            Coba lagi
          </button>
        ) : null}
      </p>
    );
  }
  if (!stats) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-11 items-center gap-3 px-2">
            <Skeleton className="h-3 w-3" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-1.5 w-full" />
            </div>
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (stats.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="Belum ada prediksi"
        description={emptyDescription}
        className={cn("py-6", className)}
      />
    );
  }
  return (
    <ol className={cn("flex flex-col", className)}>
      {stats.slice(0, 5).map((region, index) => {
        const level = getRiskLevel(region.rata_skor_risiko);
        return (
          <li key={region.slug}>
            <Link
              href={regionHref(region)}
              aria-current={region.slug === highlight ? "true" : undefined}
              className={cn(
                "group -mx-1 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/70",
                region.slug === highlight && "bg-ember-soft hover:bg-ember-soft",
              )}
            >
              <span className="w-3 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{region.nama}</span>
                  <span className="font-mono text-xs tabular-nums">{formatDecimal(region.rata_skor_risiko)}</span>
                </span>
                <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.span
                    className={cn("block h-full origin-left rounded-full", BAR_CLASSES[level])}
                    initial={false}
                    animate={{ width: `${Math.max(2, region.rata_skor_risiko * 100)}%` }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  />
                </span>
              </span>
              <RiskBadge level={level} size="sm" />
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
});
