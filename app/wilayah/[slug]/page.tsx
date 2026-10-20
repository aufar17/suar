import { CalendarClock, CloudRain, Droplets, Flame, FlameKindling, Gauge, Sprout, Sun, Thermometer, Wind } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MonthlyBarChart } from "@/components/charts/lazy";
import { RiskForecastChart } from "@/components/charts/risk-forecast-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { RegionSwitcher } from "@/components/filters/region-switcher";
import { RegionMapPanel } from "@/components/map/region-map-panel";
import { PredictionNote, ScoreGauge } from "@/components/panels/risk-detail";
import { StatTile } from "@/components/panels/stat-tile";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/state";
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
import { getRiskLevel } from "@/lib/risk";

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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:py-6 lg:px-8 lg:py-8">
      <Suspense fallback={<RegionSkeleton />}>
        <RegionContent slug={slug} />
      </Suspense>
    </main>
  );
}

function Card({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <section aria-labelledby={labelledBy} className="min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
      {children}
    </section>
  );
}

function CardTitle({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-base font-semibold tracking-tight">
        {title}
      </h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
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

  const [regions, weather, hotspots30, trend, ...dailyStats] = await Promise.all([
    getRegions(),
    getWeather(slug),
    getHotspots({ start: start30, end: today, minConfidence: "low", bbox: region.bbox }),
    getMonthlyTrend({ start: shiftMonth(endMonth, -23), end: endMonth, slug }),
    ...targets.map((date) => getRegionStats({ date })),
  ]);

  const ownHotspots = hotspots30.features.filter((f) => f.properties.kabupaten === slug);
  const days30 = Array.from({ length: 30 }, (_, i) => addDaysIso(start30, i));
  const perDay = days30.map((day) => ownHotspots.filter((f) => f.properties.waktu_deteksi.startsWith(day)).length);
  const hotspotsToday = perDay[perDay.length - 1];
  const forecast = targets.map((date, i) => ({
    date,
    score: dailyStats[i].find((s) => s.slug === slug)?.rata_skor_risiko ?? 0,
  }));
  const tomorrow = forecast[0];
  const tomorrowLevel = getRiskLevel(tomorrow.score);
  const peakDay = forecast.reduce((best, d) => (d.score > best.score ? d : best), forecast[0]);
  const name = regionDisplayName(region);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Peta", href: "/" },
          { label: "Wilayah", href: "/wilayah" },
          { label: region.nama },
        ]}
      />

      <header className="-mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ember-ink">{region.level === "kota" ? "Kota" : "Kabupaten"} · Provinsi Riau</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <RiskBadge level={tomorrowLevel} size="lg" prefix="Risiko besok:" />
            <p className="text-sm text-muted-foreground">Data sampai {formatDate(today)}</p>
          </div>
        </div>
        <RegionSwitcher regions={regions} current={slug} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Hotspot 30 hari"
          icon={Flame}
          value={formatInteger(ownHotspots.length)}
          hint={
            <>
              <span className="font-medium text-foreground">{formatInteger(hotspotsToday)}</span> hari ini ·{" "}
              {formatDayShort(start30)} – {formatDayShort(today)}
            </>
          }
          figure={<Sparkline values={perDay} area />}
        />
        <StatTile
          label="Rata-rata skor risiko besok"
          icon={Gauge}
          value={formatDecimal(tomorrow.score)}
          hint={`${formatDayShort(tomorrow.date)} · puncak 7 hari ${formatDecimal(peakDay.score)} (${formatDayShort(peakDay.date)})`}
          figure={<ScoreGauge score={tomorrow.score} level={tomorrowLevel} />}
        />
        <StatTile
          label="Area gambut"
          icon={Sprout}
          value={formatPercent(region.persen_gambut, 1)}
          hint={`${formatInteger(region.jumlah_sel)} kotak grid · ±${formatInteger(region.luas_km2)} km²`}
          className="sm:col-span-2 lg:col-span-1"
          figure={
            <div
              role="meter"
              aria-label="Persentase area gambut"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={region.persen_gambut}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-[var(--map-gambut)]" style={{ width: `${region.persen_gambut}%` }} />
            </div>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section aria-label={`Peta ${name}`} className="lg:col-span-2">
          <RegionMapPanel
            slug={slug}
            name={region.nama}
            bbox={region.bbox}
            hotspotStart={addDaysIso(today, -6)}
            hotspotEnd={today}
            targetDate={tomorrow.date}
          />
        </section>
        <Card labelledBy="cuaca">
          <CardTitle
            id="cuaca"
            title="Cuaca terkini"
            description={weather ? `${formatDayShort(weather.tanggal)} · Open-Meteo` : undefined}
          />
          {weather ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sun aria-hidden="true" className="size-3.5" /> Hari tanpa hujan
                </p>
                <p className="mt-1 text-5xl font-semibold tracking-tight">
                  <span className="font-mono">{formatInteger(weather.hari_tanpa_hujan)}</span>
                  <span className="ml-1.5 text-base font-medium text-muted-foreground">hari</span>
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {[
                  { icon: Thermometer, label: "Suhu", value: `${formatDecimal(weather.suhu_c, 1)} °C` },
                  { icon: Droplets, label: "Kelembapan", value: `${formatInteger(weather.kelembapan_persen)}%` },
                  { icon: CloudRain, label: "Curah hujan", value: `${formatDecimal(weather.curah_hujan_mm, 1)} mm` },
                  { icon: Wind, label: "Angin", value: `${formatDecimal(weather.kecepatan_angin_kmh, 1)} km/j` },
                ].map((item) => (
                  <div key={item.label} className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/70 px-3 py-2.5">
                    <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <item.icon aria-hidden="true" className="size-3.5 shrink-0" />
                      {item.label}
                    </dt>
                    <dd className="truncate font-mono text-sm font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-4" />
              Data cuaca belum tersedia untuk wilayah ini.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card labelledBy="prediksi">
          <CardTitle id="prediksi" title="Prediksi risiko 7 hari" description="Rata-rata skor risiko seluruh kotak grid di wilayah ini." />
          <RiskForecastChart days={forecast} />
          <PredictionNote className="mt-3" />
        </Card>
        <Card labelledBy="tren">
          <CardTitle
            id="tren"
            title="Hotspot per bulan"
            description={
              trend.length
                ? `${formatMonth(trend[0].bulan)} – ${formatMonth(trend[trend.length - 1].bulan)} · bulan terakhir disorot`
                : undefined
            }
          />
          {trend.some((d) => d.jumlah_hotspot > 0) ? (
            <MonthlyBarChart data={trend} label={`Grafik batang jumlah hotspot per bulan di ${name}, 24 bulan terakhir.`} />
          ) : (
            <EmptyState
              icon={FlameKindling}
              title="Belum ada hotspot tercatat"
              description={`Tidak ada titik panas di ${name} selama 24 bulan terakhir.`}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function RegionSkeleton() {
  return (
    <div role="status" aria-label="Memuat data wilayah" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-7 w-56 rounded-full" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-2xl sm:h-[460px] lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-2xl sm:h-[460px]" />
      </div>
    </div>
  );
}
