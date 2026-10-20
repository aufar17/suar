import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { RiskForecastChart } from "@/components/charts/risk-forecast-chart";
import { RegionMapPanel } from "@/components/map/region-map-panel";
import { PredictionNote } from "@/components/panels/risk-detail";
import { SummaryCards, type SummaryItem } from "@/components/panels/summary-cards";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader } from "@/components/ui/legacy-card";
import { Skeleton } from "@/components/ui/controls";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  getDataStatus,
  getHotspots,
  getMonthlyTrend,
  getRegionDetail,
  getRegions,
  getRegionStats,
  getWeather,
} from "@/lib/data";
import { addDaysIso, formatDate, formatDayShort, formatDecimal, formatInteger, formatMonth, formatPercent } from "@/lib/format";
import { regionDisplayName } from "@/lib/labels";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";

// Every valid slug is prerendered by generateStaticParams. The slug is checked before the
// Suspense boundary so unknown slugs get a real HTTP 404 instead of a streamed soft 404,
// which means this segment cannot also pass the instant-navigation validation.
export const instant = false;

export async function generateStaticParams() {
  const regions = await getRegions();
  return regions.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({ params }: PageProps<"/wilayah/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const region = await getRegionDetail(slug);
  if (!region) return { title: "Wilayah tidak ditemukan" };
  const name = regionDisplayName(region);
  return {
    title: name,
    description: `Hotspot terbaru, cuaca, prediksi risiko kebakaran 7 hari, dan tren bulanan untuk ${name}, Riau.`,
  };
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export default async function WilayahPage({ params }: PageProps<"/wilayah/[slug]">) {
  const { slug } = await params;
  const regions = await getRegions();
  if (!regions.some((r) => r.slug === slug)) notFound();
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Suspense fallback={<RegionSkeleton />}>
        <RegionContent slug={slug} />
      </Suspense>
    </main>
  );
}

function RegionSkeleton() {
  return (
    <div role="status" aria-label="Memuat data wilayah" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

async function RegionContent({ slug }: { slug: string }) {
  const region = await getRegionDetail(slug);
  if (!region) notFound();

  const status = await getDataStatus();
  const today = status.tanggal_data;
  const start30 = addDaysIso(today, -29);
  const endMonth = today.slice(0, 7);
  const targets = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i + 1));

  const [weather, hotspots30, trend, ...dailyStats] = await Promise.all([
    getWeather(slug),
    getHotspots({ start: start30, end: today, minConfidence: "low", bbox: region.bbox }),
    getMonthlyTrend({ start: shiftMonth(endMonth, -23), end: endMonth, slug }),
    ...targets.map((date) => getRegionStats({ date })),
  ]);

  const ownHotspots = hotspots30.features.filter((f) => f.properties.kabupaten === slug);
  const hotspotsToday = ownHotspots.filter((f) => f.properties.waktu_deteksi.startsWith(today)).length;
  const forecast = targets.map((date, i) => ({
    date,
    score: dailyStats[i].find((s) => s.slug === slug)?.rata_skor_risiko ?? 0,
  }));
  const tomorrow = forecast[0];
  const tomorrowLevel = getRiskLevel(tomorrow.score);
  const name = regionDisplayName(region);

  const summary: SummaryItem[] = [
    { label: "Hotspot hari ini", value: formatInteger(hotspotsToday), hint: formatDayShort(today) },
    {
      label: "Hotspot 30 hari",
      value: formatInteger(ownHotspots.length),
      hint: `${formatDayShort(start30)} – ${formatDayShort(today)}`,
    },
    {
      label: "Rata-rata skor risiko besok",
      value: formatDecimal(tomorrow.score),
      hint: `${getRiskLabel(tomorrowLevel)} · ${formatDayShort(tomorrow.date)}`,
    },
    {
      label: "Area gambut",
      value: formatPercent(region.persen_gambut, 1),
      hint: `${formatInteger(region.jumlah_sel)} kotak grid · ±${formatInteger(region.luas_km2)} km²`,
    },
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Peta", href: "/" },
          { label: "Wilayah", href: "/wilayah" },
          { label: region.nama },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Data sampai {formatDate(today)}</p>
        </div>
        <RiskBadge level={tomorrowLevel} size="lg" prefix="Risiko besok:" className="self-start sm:self-auto" />
      </div>

      <SummaryCards items={summary} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RegionMapPanel
          slug={slug}
          name={name}
          bbox={region.bbox}
          hotspotStart={addDaysIso(today, -6)}
          hotspotEnd={today}
          targetDate={tomorrow.date}
        />
        <Card className="p-4 lg:p-5">
          <CardHeader title="Cuaca terkini" description={weather ? formatDayShort(weather.tanggal) : undefined} />
          {weather ? (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Hari tanpa hujan</p>
                <p className="font-mono text-4xl font-semibold tracking-tight text-foreground">
                  {formatInteger(weather.hari_tanpa_hujan)}
                  <span className="ml-1 font-sans text-base font-medium text-muted-foreground">hari</span>
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Suhu", `${formatDecimal(weather.suhu_c, 1)} °C`],
                  ["Kelembapan", `${formatInteger(weather.kelembapan_persen)}%`],
                  ["Curah hujan", `${formatDecimal(weather.curah_hujan_mm, 1)} mm`],
                  ["Angin", `${formatDecimal(weather.kecepatan_angin_kmh, 1)} km/jam`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-mono text-base font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Data cuaca belum tersedia.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 lg:p-5">
          <CardHeader
            title="Prediksi risiko 7 hari"
            description="Rata-rata skor risiko seluruh kotak grid di wilayah ini."
            className="mb-4"
          />
          <RiskForecastChart days={forecast} />
          <div className="mt-3">
            <PredictionNote />
          </div>
        </Card>
        <Card className="p-4 lg:p-5">
          <CardHeader
            title="Hotspot per bulan"
            description={`${formatMonth(trend[0].bulan)} – ${formatMonth(trend[trend.length - 1].bulan)}`}
            className="mb-4"
          />
          <MonthlyBarChart data={trend} label={`Grafik batang jumlah hotspot per bulan di ${name}, 24 bulan terakhir.`} />
        </Card>
      </div>
    </>
  );
}
