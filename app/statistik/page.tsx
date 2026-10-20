import type { Metadata } from "next";
import { Suspense } from "react";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend-chart";
import { RegionRanking } from "@/components/charts/region-ranking";
import { YearComparisonChart } from "@/components/charts/year-comparison-chart";
import { RegionSelect } from "@/components/filters/region-select";
import { SummaryCards, type SummaryItem } from "@/components/panels/summary-cards";
import { Card, CardHeader } from "@/components/ui/legacy-card";
import { Skeleton } from "@/components/ui/controls";
import { DownloadCsvButton } from "@/components/ui/download-button";
import { getDataStatus, getMonthlyTrend, getRegions, getRegionStats, getRiskCells } from "@/lib/data";
import { addDaysIso, formatDate, formatDayShort, formatDecimal, formatInteger, formatMonth } from "@/lib/format";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";

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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:px-6">
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
  const ytd = (year: number) =>
    trend
      .filter((d) => d.bulan.startsWith(`${year}-`) && Number(d.bulan.slice(5, 7)) <= monthNumber)
      .reduce((sum, d) => sum + d.jumlah_hotspot, 0);
  const thisYear = ytd(currentYear);
  const lastYear = ytd(currentYear - 1);
  const change = lastYear > 0 ? ((thisYear - lastYear) / lastYear) * 100 : null;
  const peak = trend.reduce((max, d) => (d.jumlah_hotspot > max.jumlah_hotspot ? d : max), trend[0]);
  const scopedCells = cells.features.filter((f) => !slug || f.properties.kabupaten === slug);
  const meanRisk = scopedCells.length
    ? scopedCells.reduce((sum, f) => sum + f.properties.skor_risiko, 0) / scopedCells.length
    : 0;

  const scopeName = region ? region.nama : "Provinsi Riau";
  const summary: SummaryItem[] = [
    {
      label: "Total hotspot 24 bulan",
      value: formatInteger(total),
      hint: `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`,
    },
    {
      label: `Hotspot ${currentYear} (s.d. ${formatMonth(endMonth, false)})`,
      value: formatInteger(thisYear),
      hint:
        change === null
          ? `Belum ada data ${currentYear - 1}`
          : `${change >= 0 ? "+" : "−"}${formatDecimal(Math.abs(change), 0)}% dibanding periode sama ${currentYear - 1}`,
    },
    {
      label: "Bulan puncak",
      value: formatMonth(peak.bulan),
      mono: false,
      hint: `${formatInteger(peak.jumlah_hotspot)} hotspot`,
    },
    {
      label: "Rata-rata skor risiko besok",
      value: formatDecimal(meanRisk),
      hint: `${getRiskLabel(getRiskLevel(meanRisk))} · ${formatDayShort(status.prediksi_mulai)}`,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Statistik hotspot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scopeName} · data sampai {formatDate(status.tanggal_data)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <RegionSelect regions={regions} value={region?.slug ?? null} />
          <DownloadCsvButton
            filename={`siapi-hotspot-bulanan-${slug ?? "riau"}.csv`}
            header={["bulan", "wilayah", "jumlah_hotspot"]}
            rows={trend.map((d) => [d.bulan, slug ?? "riau", d.jumlah_hotspot])}
          />
        </div>
      </div>

      <SummaryCards items={summary} />

      <Card className="p-4 lg:p-5">
        <CardHeader
          title={`Jumlah hotspot per bulan · ${scopeName}`}
          description="24 bulan terakhir. Arahkan kursor ke grafik untuk melihat angka per bulan."
          className="mb-3"
        />
        <MonthlyTrendChart data={trend} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 lg:p-5">
          <CardHeader
            title="Perbandingan antar tahun"
            description={`Hotspot per bulan, ${scopeName}. Tahun berjalan ditebalkan.`}
            className="mb-3"
          />
          <YearComparisonChart data={trend} currentYear={currentYear} />
        </Card>
        <Card className="p-4 lg:p-5">
          <CardHeader
            title="Peringkat kabupaten/kota"
            description="Klik nama wilayah untuk membuka halaman detailnya."
            className="mb-3"
          />
          <RegionRanking
            stats={stats}
            highlight={region?.slug ?? null}
            hotspotPeriod={`${formatDate(rankingStart)} – ${formatDate(status.tanggal_data)}`}
            riskDateLabel={formatDayShort(status.prediksi_mulai)}
          />
        </Card>
      </div>
    </>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Memuat statistik" className="flex flex-col gap-4">
      <Skeleton className="h-14 w-72" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
