import { ArrowUpRight, Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RiskBadge } from "@/components/ui/risk-badge";
import { getDataStatus, getRegions, getRegionStats } from "@/lib/data";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

export const metadata: Metadata = {
  title: "Wilayah",
  description: "Daftar 12 kabupaten/kota di Provinsi Riau dengan prediksi risiko kebakaran besok dan jumlah hotspot 30 hari.",
};

const BAR: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/45",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

export default async function WilayahIndexPage() {
  const [status, regions] = await Promise.all([getDataStatus(), getRegions()]);
  const stats = await getRegionStats({
    date: status.prediksi_mulai,
    start: addDaysIso(status.tanggal_data, -29),
    end: status.tanggal_data,
  });
  const bySlug = new Map(stats.map((s) => [s.slug, s]));
  // Most at risk first, so the list answers "where should I look?".
  const ordered = [...regions].sort(
    (a, b) => (bySlug.get(b.slug)?.rata_skor_risiko ?? 0) - (bySlug.get(a.slug)?.rata_skor_risiko ?? 0),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
      <header>
        <p className="text-sm font-medium text-ember-ink">Wilayah</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">12 kabupaten/kota di Riau</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Diurutkan dari risiko tertinggi untuk {formatDayShort(status.prediksi_mulai)}. Jumlah hotspot dihitung 30 hari
          terakhir.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((region) => {
          const stat = bySlug.get(region.slug);
          const score = stat?.rata_skor_risiko ?? 0;
          const level = getRiskLevel(score);
          return (
            <li key={region.slug}>
              <Link
                href={`/wilayah/${region.slug}`}
                className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[var(--shadow-panel)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{region.level === "kota" ? "Kota" : "Kabupaten"}</p>
                    <p className="truncate text-lg font-semibold tracking-tight">{region.nama}</p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                  />
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Flame aria-hidden="true" className="size-3.5" />
                      <span className="font-mono text-foreground">{formatInteger(stat?.jumlah_hotspot ?? 0)}</span> hotspot
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{formatDecimal(score)}</span>
                      <RiskBadge level={level} size="sm" />
                    </span>
                  </div>
                  <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", BAR[level])} style={{ width: `${Math.max(2, score * 100)}%` }} />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
