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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDataStatus, getMonthlyTrend, getRegions, getRegionStats } from "@/lib/data";
import {
  addDaysIso,
  formatDate,
  formatDayShort,
  formatDecimal,
  formatInteger,
  formatMonth,
  shiftMonth,
} from "@/lib/format";
import { regionDisplayName } from "@/lib/labels";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Statistik",
  description:
    "Tren bulanan hotspot, perbandingan antar tahun, dan peringkat provinsi serta kabupaten/kota di seluruh Indonesia.",
};

/** Regencies shown nationally before "Tampilkan semua". */
const NATIONAL_REGENCY_LIMIT = 25;

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
  const param = (key: string) => (typeof params[key] === "string" ? params[key] : null);

  const [status, regions] = await Promise.all([getDataStatus(), getRegions()]);
  const province = regions.find((r) => r.slug === param("provinsi") && r.level === "provinsi") ?? null;
  const regency = province
    ? (regions.find((r) => r.slug === param("kabupaten") && r.provinsi === province.slug) ?? null)
    : null;
  const scope = regency ?? province;
  const slug = scope?.slug;

  const endMonth = status.tanggal_data.slice(0, 7);
  const startMonth = shiftMonth(endMonth, -23);
  const currentYear = Number(endMonth.slice(0, 4));
  const rankingStart = addDaysIso(status.tanggal_data, -364);
  const rankingWindow = { date: status.prediksi_mulai, start: rankingStart, end: status.tanggal_data };

  const [trend, provinceStats, regencyStats] = await Promise.all([
    getMonthlyTrend({ start: startMonth, end: endMonth, slug }),
    getRegionStats({ ...rankingWindow, level: "provinsi" }),
    getRegionStats({ ...rankingWindow, level: "kabupaten", provinsi: province?.slug }),
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

  // Mean risk of the scope, weighted by grid cells for the whole country.
  const scopeStat = regency
    ? regencyStats.find((s) => s.slug === regency.slug)
    : province
      ? provinceStats.find((s) => s.slug === province.slug)
      : undefined;
  const nationalCells = provinceStats.reduce((n, s) => n + s.jumlah_sel, 0);
  const meanRisk = scope
    ? (scopeStat?.rata_skor_risiko ?? 0)
    : nationalCells
      ? provinceStats.reduce((s, p) => s + p.rata_skor_risiko * p.jumlah_sel, 0) / nationalCells
      : 0;
  const cellCount = scope ? (scopeStat?.jumlah_sel ?? 0) : nationalCells;
  const meanLevel = getRiskLevel(meanRisk);

  const scopeName = scope ? regionDisplayName(scope) : "Indonesia";
  const periodLabel = `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`;
  const rising = change !== null && change >= 0;
  const hotspotPeriod = `${formatDate(rankingStart)} – ${formatDate(status.tanggal_data)}`;
  const riskDateLabel = formatDayShort(status.prediksi_mulai);

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ember-ink">Statistik</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Hotspot {scopeName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Data sampai {formatDate(status.tanggal_data)} · prediksi risiko untuk {riskDateLabel}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RegionSelect regions={regions} provinsi={province?.slug ?? null} kabupaten={regency?.slug ?? null} />
          <DownloadCsvButton
            filename={`suar-hotspot-bulanan-${slug ?? "indonesia"}.csv`}
            header={["bulan", "wilayah", "jumlah_hotspot"]}
            rows={trend.map((d) => [d.bulan, slug ?? "indonesia", d.jumlah_hotspot])}
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
          hint={`${cellCount ? formatInteger(cellCount) : "–"} kotak grid · ${riskDateLabel}`}
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
            description={`Tidak ada titik panas pada ${periodLabel}. Pilih wilayah lain atau lihat seluruh Indonesia.`}
          />
        )}
      </section>

      <section aria-labelledby="peringkat" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        <Tabs defaultValue={province ? "kabupaten" : "provinsi"} className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 id="peringkat" className="text-base font-semibold tracking-tight">
                Peringkat wilayah
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Klik nama wilayah untuk membuka halaman detailnya.</p>
            </div>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="provinsi" className="px-3">
                Provinsi
              </TabsTrigger>
              <TabsTrigger value="kabupaten" className="px-3">
                Kabupaten/kota
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="provinsi">
            <RegionRanking
              stats={provinceStats}
              highlight={province?.slug ?? null}
              hotspotPeriod={hotspotPeriod}
              riskDateLabel={riskDateLabel}
              filename="suar-peringkat-provinsi.csv"
            />
          </TabsContent>
          <TabsContent value="kabupaten" className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {province
                ? `${formatInteger(regencyStats.length)} kabupaten/kota di Provinsi ${province.nama}.`
                : `Seluruh ${formatInteger(regencyStats.length)} kabupaten/kota di Indonesia. Pilih provinsi untuk mempersempit.`}
            </p>
            <RegionRanking
              stats={regencyStats}
              highlight={regency?.slug ?? null}
              hotspotPeriod={hotspotPeriod}
              riskDateLabel={riskDateLabel}
              filename={`suar-peringkat-kabupaten-${province?.slug ?? "indonesia"}.csv`}
              limit={province ? undefined : NATIONAL_REGENCY_LIMIT}
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Memuat statistik" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-56" />
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
