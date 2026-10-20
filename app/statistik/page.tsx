import { CalendarRange, Flame, FlameKindling, Gauge, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartSkeleton } from "@/components/charts/lazy";
import { RegionRanking } from "@/components/charts/region-ranking";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendTabs } from "@/components/charts/trend-tabs";
import { RegionSelect } from "@/components/filters/region-select";
import { ScoreGauge } from "@/components/panels/risk-detail";
import { StatTile } from "@/components/panels/stat-tile";
import { DownloadCsvButton } from "@/components/ui/download-button";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/state";
import { getDataStatus, getMonthlyTrend, getRegions, getRegionStats, getRiskCells } from "@/lib/data";
import { addDaysIso, formatDate, formatDayShort, formatDecimal, formatInteger, formatMonth } from "@/lib/format";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistik",
  description: "Tren bulanan hotspot, perbandingan antar tahun, dan peringkat kabupaten/kota di Provinsi Riau.",
};

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export default function StatistikPage({ searchParams }: PageProps<"/statistik">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsContent({ searchParams }: { searchParams: PageProps<"/statistik">["searchParams"] }) {
  const params = await searchParams;
  const requested = typeof params.kabupaten === "string" ? params.kabupaten : null;

  const [status, regions] = await Promise.all([getDataStatus(), getRegions()]);
  const region = regions.find((r) => r.slug === requested) ?? null;
  const slug = region?.slug;

  const endMonth = status.tanggal_data.slice(0, 7);
  const startMonth = shiftMonth(endMonth, -23);
  const currentYear = Number(endMonth.slice(0, 4));
  const rankingStart = addDaysIso(status.tanggal_data, -364);

  const [trend, stats, cells] = await Promise.all([
    getMonthlyTrend({ start: startMonth, end: endMonth, slug }),
    getRegionStats({ date: status.prediksi_mulai, start: rankingStart, end: status.tanggal_data }),
    getRiskCells({ targetDate: status.prediksi_mulai }),
  ]);

  // Summary
  const total = trend.reduce((sum, d) => sum + d.jumlah_hotspot, 0);
  const monthNumber = Number(endMonth.slice(5, 7));
  const ytdMonths = (year: number) =>
    trend.filter((d) => d.bulan.startsWith(`${year}-`) && Number(d.bulan.slice(5, 7)) <= monthNumber);
  const sum = (items: { jumlah_hotspot: number }[]) => items.reduce((s, d) => s + d.jumlah_hotspot, 0);
  const thisYearMonths = ytdMonths(currentYear);
  const thisYear = sum(thisYearMonths);
  const lastYear = sum(ytdMonths(currentYear - 1));
  const change = lastYear > 0 ? ((thisYear - lastYear) / lastYear) * 100 : null;
  const peakIndex = trend.reduce((best, d, i) => (d.jumlah_hotspot > trend[best].jumlah_hotspot ? i : best), 0);
  const peak = trend[peakIndex];
  const scopedCells = cells.features.filter((f) => !slug || f.properties.kabupaten === slug);
  const meanRisk = scopedCells.length
    ? scopedCells.reduce((s, f) => s + f.properties.skor_risiko, 0) / scopedCells.length
    : 0;
  const meanLevel = getRiskLevel(meanRisk);

  const scopeName = region ? region.nama : "Provinsi Riau";
  const periodLabel = `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`;
  const rising = change !== null && change >= 0;

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-ember-ink">Statistik</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Hotspot {scopeName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Data sampai {formatDate(status.tanggal_data)} · prediksi risiko untuk {formatDayShort(status.prediksi_mulai)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RegionSelect regions={regions} value={region?.slug ?? null} />
          <DownloadCsvButton
            filename={`siapi-hotspot-bulanan-${slug ?? "riau"}.csv`}
            header={["bulan", "wilayah", "jumlah_hotspot"]}
            rows={trend.map((d) => [d.bulan, slug ?? "riau", d.jumlah_hotspot])}
          />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto]">
        <StatTile
          size="lg"
          label="Total hotspot 24 bulan"
          icon={Flame}
          value={formatInteger(total)}
          hint={periodLabel}
          className="sm:col-span-2 lg:row-span-2"
          figure={<Sparkline values={trend.map((d) => d.jumlah_hotspot)} area className="h-24 sm:h-32" />}
        />
        <StatTile
          label={`Hotspot ${currentYear} (s.d. ${formatMonth(endMonth, false)})`}
          icon={CalendarRange}
          value={formatInteger(thisYear)}
          hint={
            change === null ? (
              `Belum ada data ${currentYear - 1}`
            ) : (
              <span className="inline-flex items-center gap-1">
                {rising ? (
                  <TrendingUp aria-hidden="true" className="size-3.5 text-ember-ink" />
                ) : (
                  <TrendingDown aria-hidden="true" className="size-3.5 text-emerald-700 dark:text-emerald-400" />
                )}
                <span className={cn("font-medium", rising ? "text-ember-ink" : "text-emerald-700 dark:text-emerald-400")}>
                  {rising ? "+" : "−"}
                  {formatDecimal(Math.abs(change), 0)}%
                </span>
                vs periode sama {currentYear - 1}
              </span>
            )
          }
          figure={<Sparkline values={thisYearMonths.map((d) => d.jumlah_hotspot)} />}
        />
        <StatTile
          label="Bulan puncak"
          icon={Trophy}
          value={formatMonth(peak.bulan)}
          mono={false}
          hint={`${formatInteger(peak.jumlah_hotspot)} hotspot`}
          figure={<Sparkline values={trend.map((d) => d.jumlah_hotspot)} highlight={peakIndex} />}
        />
        <StatTile
          label="Rata-rata skor risiko besok"
          icon={Gauge}
          value={
            <span className="flex items-center gap-3">
              {formatDecimal(meanRisk)}
              <RiskBadge level={meanLevel} className="font-sans" />
            </span>
          }
          hint={`${scopedCells.length ? formatInteger(scopedCells.length) : "–"} kotak grid · ${formatDayShort(status.prediksi_mulai)}`}
          className="sm:col-span-2"
          figure={<ScoreGauge score={meanRisk} level={meanLevel} />}
        />
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        {total > 0 ? (
          <TrendTabs trend={trend} currentYear={currentYear} scopeName={scopeName} periodLabel={periodLabel} />
        ) : (
          <EmptyState
            icon={FlameKindling}
            title={`Belum ada hotspot tercatat di ${scopeName}`}
            description={`Tidak ada titik panas pada ${periodLabel}. Pilih wilayah lain atau lihat seluruh provinsi.`}
          />
        )}
      </section>

      <section aria-labelledby="peringkat" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        <div className="mb-4">
          <h2 id="peringkat" className="text-base font-semibold tracking-tight">
            Peringkat kabupaten/kota
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Klik nama wilayah untuk membuka halaman detailnya.</p>
        </div>
        <RegionRanking
          stats={stats}
          highlight={region?.slug ?? null}
          hotspotPeriod={`${formatDate(rankingStart)} – ${formatDate(status.tanggal_data)}`}
          riskDateLabel={formatDayShort(status.prediksi_mulai)}
        />
      </section>
    </>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Memuat statistik" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-56 rounded-2xl sm:col-span-2 lg:row-span-2 lg:h-auto" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl sm:col-span-2" />
      </div>
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="mb-4 flex justify-between gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-52" />
        </div>
        <ChartSkeleton />
      </div>
    </div>
  );
}
