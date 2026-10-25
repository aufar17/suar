"use client";

import { ChevronDown, ChevronRight, MapPinOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DownloadCsvButton } from "@/components/ui/download-button";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/state";
import { formatDecimal, formatInteger } from "@/lib/format";
import { regionHref } from "@/lib/labels";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RegionStat, RiskLevel } from "@/types";

type SortKey = "hotspot" | "risiko";

const RISK_BAR: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/45",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

/** Horizontal bar ranking of regions, sortable by hotspot count or mean risk score. Rows slide when re-sorted. */
export function RegionRanking({
  stats,
  highlight,
  hotspotPeriod,
  riskDateLabel,
  filename = "suar-peringkat-wilayah.csv",
  limit,
}: {
  stats: RegionStat[];
  highlight: string | null;
  hotspotPeriod: string;
  riskDateLabel: string;
  filename?: string;
  /** Rows shown before "Tampilkan semua" (all when omitted). */
  limit?: number;
}) {
  const [sort, setSort] = useState<SortKey>("hotspot");
  const [expanded, setExpanded] = useState(false);
  const sorted = [...stats].sort((a, b) =>
    sort === "hotspot" ? b.jumlah_hotspot - a.jumlah_hotspot : b.rata_skor_risiko - a.rata_skor_risiko,
  );
  const maxHotspot = Math.max(1, ...stats.map((s) => s.jumlah_hotspot));
  if (stats.length === 0) {
    return <EmptyState icon={MapPinOff} title="Belum ada data peringkat" description="Statistik wilayah belum tersedia untuk periode ini." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Urutkan peringkat berdasarkan"
          value={sort}
          onChange={setSort}
          options={[
            { value: "hotspot", label: "Jumlah hotspot" },
            { value: "risiko", label: "Skor risiko" },
          ]}
          className="w-full sm:w-72"
        />
        <DownloadCsvButton
          variant="outline"
          label="CSV"
          filename={filename}
          header={["slug", "nama", "level", "provinsi", "jumlah_hotspot", "rata_skor_risiko", "maks_skor_risiko"]}
          rows={sorted.map((s) => [
            s.slug,
            s.nama,
            s.level,
            s.provinsi ?? "",
            s.jumlah_hotspot,
            s.rata_skor_risiko,
            s.maks_skor_risiko,
          ])}
          className="h-9"
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {sort === "hotspot" ? `Jumlah hotspot, ${hotspotPeriod}.` : `Rata-rata skor risiko prediksi untuk ${riskDateLabel}.`}
      </p>
      <ol className="flex flex-col">
        {(limit && !expanded ? sorted.slice(0, limit) : sorted).map((region, index) => {
          const value = sort === "hotspot" ? region.jumlah_hotspot / maxHotspot : region.rata_skor_risiko;
          const level = getRiskLevel(region.rata_skor_risiko);
          const active = region.slug === highlight;
          return (
            <motion.li key={region.slug} layout="position" transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>
              <Link
                href={regionHref(region)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group -mx-2 grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/70 sm:grid-cols-[1.5rem_minmax(0,9rem)_minmax(0,1fr)_auto]",
                  active && "bg-ember-soft hover:bg-ember-soft",
                )}
              >
                <span className="row-span-2 font-mono text-xs text-muted-foreground tabular-nums sm:row-span-1">{index + 1}</span>
                <span className={cn("truncate text-sm", active && "font-semibold")}>{region.nama}</span>
                <span
                  aria-hidden="true"
                  className="col-start-2 row-start-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-2"
                >
                  <motion.span
                    className={cn(
                      "block h-full rounded-full",
                      sort === "risiko" ? RISK_BAR[level] : active ? "bg-ember" : "bg-foreground/75",
                    )}
                    initial={false}
                    animate={{ width: `${Math.max(1.5, value * 100)}%` }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  />
                </span>
                <span className="col-start-3 row-span-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-4 sm:row-span-1">
                  <span className="w-12 text-right font-mono text-sm tabular-nums">
                    {sort === "hotspot" ? formatInteger(region.jumlah_hotspot) : formatDecimal(region.rata_skor_risiko)}
                  </span>
                  {sort === "risiko" ? <RiskBadge level={level} size="sm" className="w-[5.5rem] justify-center" /> : null}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ol>
      {limit && sorted.length > limit ? (
        <Button variant="outline" onClick={() => setExpanded((value) => !value)} className="self-start" aria-expanded={expanded}>
          <ChevronDown className={cn("transition-transform duration-200", expanded && "rotate-180")} />
          {expanded ? `Tampilkan ${limit} teratas` : `Tampilkan semua (${formatInteger(sorted.length)})`}
        </Button>
      ) : null}
    </div>
  );
}
