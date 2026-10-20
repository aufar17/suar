"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/controls";
import { DownloadCsvButton } from "@/components/ui/download-button";
import { RiskBadge } from "@/components/ui/risk-badge";
import { formatDecimal, formatInteger } from "@/lib/format";
import { getRiskLevel } from "@/lib/risk";
import type { RegionStat } from "@/types";

type SortKey = "hotspot" | "risiko";

/** Horizontal bar ranking of regions, sortable by hotspot count or mean risk score. */
export function RegionRanking({
  stats,
  highlight,
  hotspotPeriod,
  riskDateLabel,
}: {
  stats: RegionStat[];
  highlight: string | null;
  hotspotPeriod: string;
  riskDateLabel: string;
}) {
  const [sort, setSort] = useState<SortKey>("hotspot");
  const sorted = [...stats].sort((a, b) =>
    sort === "hotspot" ? b.jumlah_hotspot - a.jumlah_hotspot : b.rata_skor_risiko - a.rata_skor_risiko,
  );
  const maxHotspot = Math.max(1, ...stats.map((s) => s.jumlah_hotspot));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl
          label="Urutkan berdasarkan"
          value={sort}
          onChange={setSort}
          options={[
            { value: "hotspot", label: "Jumlah hotspot" },
            { value: "risiko", label: "Skor risiko" },
          ]}
          className="w-full sm:w-72"
        />
        <DownloadCsvButton
          variant="ghost"
          filename="siapi-peringkat-kabupaten.csv"
          header={["slug", "nama", "jumlah_hotspot", "rata_skor_risiko"]}
          rows={sorted.map((s) => [s.slug, s.nama, s.jumlah_hotspot, s.rata_skor_risiko])}
        />
      </div>
      <p className="text-xs text-fg-muted">
        {sort === "hotspot" ? `Jumlah hotspot, ${hotspotPeriod}.` : `Rata-rata skor risiko prediksi untuk ${riskDateLabel}.`}
      </p>
      <ol className="flex flex-col gap-1">
        {sorted.map((region, index) => {
          const value = sort === "hotspot" ? region.jumlah_hotspot / maxHotspot : region.rata_skor_risiko;
          const active = region.slug === highlight;
          return (
            <li key={region.slug}>
              <Link
                href={`/wilayah/${region.slug}`}
                className={clsx(
                  "-mx-2 grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 hover:bg-surface-2 sm:grid-cols-[1.25rem_minmax(0,9rem)_minmax(0,1fr)_auto]",
                  active && "bg-primary-soft",
                )}
                aria-current={active ? "true" : undefined}
              >
                <span className="row-span-2 font-mono text-xs text-fg-muted sm:row-span-1">{index + 1}</span>
                <span className={clsx("truncate text-sm", active ? "font-semibold text-fg" : "text-fg")}>{region.nama}</span>
                <span aria-hidden="true" className="col-start-2 row-start-2 mt-1 h-2 rounded-r-[4px] bg-surface-2 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:h-2.5">
                  <span
                    className={clsx("block h-full rounded-r-[4px]", active ? "bg-accent" : "bg-primary")}
                    style={{ width: `${Math.max(1, value * 100)}%` }}
                  />
                </span>
                <span className="col-start-3 row-span-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-4 sm:row-span-1">
                  <span className="w-12 text-right font-mono text-sm text-fg">
                    {sort === "hotspot" ? formatInteger(region.jumlah_hotspot) : formatDecimal(region.rata_skor_risiko)}
                  </span>
                  {sort === "risiko" ? <RiskBadge level={getRiskLevel(region.rata_skor_risiko)} size="sm" /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
