import {
  CalendarClock,
  CloudRain,
  Droplets,
  Flame,
  FlameKindling,
  Gauge,
  MapPinOff,
  Sprout,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MonthlyBarChart } from "@/components/charts/lazy";
import { RegionRanking } from "@/components/charts/region-ranking";
import { RiskForecastChart } from "@/components/charts/risk-forecast-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { RegionSwitcher } from "@/components/filters/region-switcher";
import { RegionMapPanel } from "@/components/map/region-map-panel";
import { PredictionNote, ScoreGauge } from "@/components/panels/risk-detail";
import { StatTile } from "@/components/panels/stat-tile";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { NoPredictionBadge, RiskBadge } from "@/components/ui/risk-badge";
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
import {
  addDaysIso,
  formatDate,
  formatDayShort,
  formatDecimal,
  formatInteger,
  formatMonth,
  formatPercent,
  shiftMonth,
} from "@/lib/format";
import { REGION_LEVEL_LABELS, regionDisplayName, regionHref } from "@/lib/labels";
import { getRiskLevel, hasPrediction, NO_PREDICTION_MESSAGE } from "@/lib/risk";

function Card({ children, labelledBy, className }: { children: ReactNode; labelledBy: string; className?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-6 ${className ?? ""}`}>
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

/**
 * Region page body for a province or a regency/city: summary tiles, map, weather, 7-day
 * prediction, and monthly trend. Provinces also rank their regencies and cities.
 */
export async function RegionOverview({ slug }: { slug: string }) {
  const region = await getRegionDetail(slug);
  if (!region) notFound();

  const isProvince = region.level === "provinsi";
  const area = isProvince ? { provinsi: slug } : { kabupaten: slug };
  const status = await getDataStatus();
  const today = status.tanggal_data;
  const start30 = addDaysIso(today, -29);
  const endMonth = today.slice(0, 7);
  const targets = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i + 1));

  const [regions, weather, hotspots30, trend, regencyStats, ...dailyStats] = await Promise.all([
    getRegions(),
    getWeather(slug),
    getHotspots({ start: start30, end: today, minConfidence: "low", ...area }),
    getMonthlyTrend({ start: shiftMonth(endMonth, -23), end: endMonth, slug }),
    isProvince
      ? getRegionStats({ date: targets[0], start: start30, end: today, level: "kabupaten", provinsi: slug })
      : Promise.resolve(null),
    ...targets.map((date) => getRegionStats({ date, level: isProvince ? "provinsi" : "kabupaten" })),
  ]);

  const days30 = Array.from({ length: 30 }, (_, i) => addDaysIso(start30, i));
  const perDay = days30.map((day) => hotspots30.features.filter((f) => f.properties.waktu_deteksi.startsWith(day)).length);
  const hotspotsToday = perDay[perDay.length - 1];
  // Regions outside the predicted provinces have no grid cells: their score of 0 means "not computed".
  const predicted = hasPrediction(dailyStats[0].find((s) => s.slug === slug));
  const forecast = targets.map((date, i) => ({
    date,
    score: dailyStats[i].find((s) => s.slug === slug)?.rata_skor_risiko ?? 0,
  }));
  const tomorrow = forecast[0];
  const tomorrowLevel = getRiskLevel(tomorrow.score);
  const peakDay = forecast.reduce((best, d) => (d.score > best.score ? d : best), forecast[0]);
  const name = regionDisplayName(region);
  const kind = REGION_LEVEL_LABELS[region.level];

  // Province pages switch between provinces; regency pages between regencies of the same province.
  const switchOptions = regions
    .filter((r) => (isProvince ? r.level === "provinsi" : r.provinsi === region.provinsi))
    .map((r) => ({ slug: r.slug, nama: r.nama, href: regionHref(r) }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Peta", href: "/" },
          { label: "Wilayah", href: "/wilayah" },
          ...(region.provinsi && region.nama_provinsi
            ? [{ label: region.nama_provinsi, href: regionHref({ slug: region.provinsi, provinsi: null }) }]
            : []),
          { label: region.nama },
        ]}
      />

      <header className="-mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ember-ink">
            {isProvince
              ? `Provinsi · ${formatInteger(region.jumlah_kabupaten)} kabupaten/kota`
              : `${kind} · Provinsi ${region.nama_provinsi ?? ""}`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {predicted ? (
              <RiskBadge level={tomorrowLevel} size="lg" prefix="Risiko besok:" />
            ) : (
              <NoPredictionBadge size="lg" label={NO_PREDICTION_MESSAGE} className="whitespace-normal" />
            )}
            <p className="text-sm text-muted-foreground">Data sampai {formatDate(today)}</p>
          </div>
        </div>
        <RegionSwitcher
          options={switchOptions}
          current={slug}
          label={isProvince ? "Pindah ke provinsi lain" : `Pindah ke kabupaten/kota lain di ${region.nama_provinsi ?? "provinsi ini"}`}
        />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Hotspot 30 hari"
          icon={Flame}
          value={formatInteger(hotspots30.features.length)}
          hint={
            <>
              <span className="font-medium text-foreground">{formatInteger(hotspotsToday)}</span> hari ini ·{" "}
              {formatDayShort(start30)} – {formatDayShort(today)}
            </>
          }
          figure={<Sparkline values={perDay} area />}
        />
        {predicted ? (
          <StatTile
            label="Rata-rata skor risiko besok"
            icon={Gauge}
            value={formatDecimal(tomorrow.score)}
            hint={`${formatDayShort(tomorrow.date)} · puncak 7 hari ${formatDecimal(peakDay.score)} (${formatDayShort(peakDay.date)})`}
            figure={<ScoreGauge score={tomorrow.score} level={tomorrowLevel} />}
          />
        ) : (
          <StatTile label="Rata-rata skor risiko besok" icon={Gauge} value="–" hint={`${NO_PREDICTION_MESSAGE}.`} />
        )}
        <StatTile
          label="Area gambut"
          icon={Sprout}
          value={region.persen_gambut === null ? "–" : formatPercent(region.persen_gambut, 1)}
          hint={
            region.persen_gambut === null
              ? `Data gambut belum tersedia · ±${formatInteger(region.luas_km2)} km²`
              : `${formatInteger(region.jumlah_sel)} kotak grid · ±${formatInteger(region.luas_km2)} km²`
          }
          className="sm:col-span-2 lg:col-span-1"
          figure={
            region.persen_gambut === null ? undefined : (
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
            )
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section aria-label={`Peta ${name}`} className="lg:col-span-2">
          <RegionMapPanel
            slug={slug}
            name={region.nama}
            kind={isProvince ? "provinsi" : "kabupaten"}
            provinsi={region.provinsi ?? slug}
            bbox={region.bbox}
            hotspotStart={addDaysIso(today, -6)}
            hotspotEnd={today}
            targetDate={tomorrow.date}
            predicted={predicted}
          />
        </section>
        <Card labelledBy="cuaca">
          <CardTitle
            id="cuaca"
            title="Cuaca terkini"
            description={
              weather
                ? `${formatDayShort(weather.tanggal)} · ${isProvince ? `rata-rata ${formatInteger(region.jumlah_kabupaten)} kabupaten/kota · ` : ""}Open-Meteo`
                : undefined
            }
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
          <CardTitle
            id="prediksi"
            title="Prediksi risiko 7 hari"
            description="Rata-rata skor risiko seluruh kotak grid di wilayah ini."
          />
          {predicted ? (
            <>
              <RiskForecastChart days={forecast} />
              <PredictionNote className="mt-3" />
            </>
          ) : (
            <EmptyState
              icon={MapPinOff}
              title={NO_PREDICTION_MESSAGE}
              description="Prediksi saat ini hanya dibuat untuk provinsi rawan karhutla. Data hotspot dan cuaca tetap ditampilkan."
            />
          )}
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

      {regencyStats ? (
        <Card labelledBy="kabupaten-kota">
          <CardTitle
            id="kabupaten-kota"
            title={`Kabupaten/kota di ${name}`}
            description="Klik nama wilayah untuk membuka halaman detailnya."
          />
          <RegionRanking
            stats={regencyStats}
            highlight={null}
            hotspotPeriod={`${formatDate(start30)} – ${formatDate(today)}`}
            riskDateLabel={formatDayShort(tomorrow.date)}
            filename={`suar-peringkat-kabupaten-${slug}.csv`}
          />
        </Card>
      ) : null}
    </>
  );
}

export function RegionSkeleton() {
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
