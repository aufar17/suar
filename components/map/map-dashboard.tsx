"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  ConfidenceControl,
  FilterPanel,
  LayerToggles,
  RANGE_LABELS,
  TimeRangeControl,
  type LayerOption,
} from "@/components/filters/filter-panel";
import { LayerChips } from "@/components/filters/layer-chips";
import { OpacitySlider, PredictionDayChips, PredictionDaySlider } from "@/components/filters/prediction-day";
import { BottomSheet } from "@/components/panels/bottom-sheet";
import { ClusterDetail } from "@/components/panels/detail-panel";
import { CellDetail } from "@/components/panels/risk-detail";
import { SummaryCards, type SummaryItem } from "@/components/panels/summary-cards";
import { TopRegions } from "@/components/panels/top-regions";
import { Card } from "@/components/ui/legacy-card";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";
import { useJson } from "@/lib/use-json";
import type {
  ClusterCollection,
  DataStatus,
  HotspotCollection,
  RegionBoundaryCollection,
  RegionStat,
  RegionWeather,
  RiskCellCollection,
} from "@/types";
import { BoundaryGlyph, HotspotGlyph, PeatGlyph, RiskGlyph, ZoneGlyph } from "./legend-icons";
import { MapLegend } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";
import type { MapSelection, SelectedFeature } from "./selection";
import { useMapFilters } from "./use-map-filters";

const DashboardMap = dynamic(() => import("./dashboard-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const LAYERS: LayerOption[] = [
  { key: "risiko", label: "Prediksi risiko", description: "Grid 5 km, skor 0–1", icon: <RiskGlyph /> },
  { key: "hotspot", label: "Hotspot", description: "Titik panas satelit", icon: <HotspotGlyph size={10} /> },
  { key: "zona", label: "Zona kebakaran", description: "Kelompok hotspot hari terakhir", icon: <ZoneGlyph /> },
  { key: "batas", label: "Batas wilayah", description: "Kabupaten/kota, nama saat disorot", icon: <BoundaryGlyph /> },
  { key: "gambut", label: "Lahan gambut", description: "Sebaran gambut per kotak grid", icon: <PeatGlyph /> },
];

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

export function MapDashboard({ status }: { status: DataStatus }) {
  const { filters, setFilters, toggleLayer } = useMapFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [riskOpacity, setRiskOpacity] = useState(0.7);

  const end = status.tanggal_data;
  const start = addDaysIso(end, -(filters.rentang - 1));
  const rangeHint = start === end ? formatDayShort(end) : `${formatDayShort(start)} – ${formatDayShort(end)}`;
  const targetDate = addDaysIso(status.tanggal_data, filters.prediksi);

  const hotspots = useJson<HotspotCollection>(`/api/hotspots?start=${start}&end=${end}&min_confidence=${filters.conf}`);
  const clusters = useJson<ClusterCollection>(`/api/clusters?date=${end}`);
  const risk = useJson<RiskCellCollection>(`/api/risk?target_date=${targetDate}`);
  const regionStats = useJson<RegionStat[]>(`/api/stats/regions?date=${targetDate}`);
  const regions = useJson<RegionBoundaryCollection>("/api/regions");
  const weather = useJson<RegionWeather[]>("/api/weather");

  const regionNames = useMemo(
    () => Object.fromEntries((regions.data?.features ?? []).map((f) => [f.properties.slug, f.properties.nama])),
    [regions.data],
  );
  const regionName = (slug: string) => regionNames[slug] ?? slug;

  const select = (next: MapSelection | null) => {
    setSelection(next);
    if (next) setSheetOpen(true);
  };

  const selected = useMemo((): SelectedFeature | null => {
    if (selection?.kind === "cluster") {
      const feature = clusters.data?.features.find((f) => f.properties.id === selection.id);
      return feature ? { kind: "cluster", feature } : null;
    }
    if (selection?.kind === "cell") {
      const feature = risk.data?.features.find((f) => f.properties.cell_id === selection.id);
      return feature ? { kind: "cell", feature } : null;
    }
    return null;
  }, [selection, clusters.data, risk.data]);

  // Summary values
  const hotspotCount = hotspots.loading ? undefined : hotspots.data?.features.length;
  const topHotspotRegion = useMemo(() => {
    const counts = countBy(hotspots.data?.features ?? [], (f) => f.properties.kabupaten);
    const [slug, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return slug ? { slug, count: count ?? 0 } : null;
  }, [hotspots.data]);
  const mostAtRisk = regionStats.loading ? undefined : (regionStats.data?.[0] ?? null);
  const avgDryDays = weather.data?.length
    ? weather.data.reduce((sum, w) => sum + w.cuaca.hari_tanpa_hujan, 0) / weather.data.length
    : undefined;

  const summary: SummaryItem[] = [
    {
      label: `Hotspot ${RANGE_LABELS[filters.rentang]} terakhir`,
      value: hotspotCount === undefined ? undefined : formatInteger(hotspotCount),
      hint: topHotspotRegion
        ? `Terbanyak: ${regionName(topHotspotRegion.slug)} (${formatInteger(topHotspotRegion.count)})`
        : rangeHint,
    },
    {
      label: "Zona kebakaran aktif",
      value: clusters.data ? formatInteger(clusters.data.features.length) : undefined,
      hint: clusters.data
        ? `${clusters.data.features.filter((f) => f.properties.status === "baru").length} baru, ${clusters.data.features.filter((f) => f.properties.status === "meluas").length} meluas`
        : undefined,
    },
    {
      label: "Kabupaten paling rawan",
      mono: false,
      value: mostAtRisk === undefined ? undefined : mostAtRisk ? mostAtRisk.nama : "–",
      hint: mostAtRisk
        ? `Skor ${formatDecimal(mostAtRisk.rata_skor_risiko)} · ${getRiskLabel(getRiskLevel(mostAtRisk.rata_skor_risiko))} · ${formatDayShort(targetDate)}`
        : undefined,
    },
    {
      label: "Rata-rata hari tanpa hujan",
      value: avgDryDays === undefined ? undefined : `${formatDecimal(avgDryDays, 1)} hari`,
      hint: "Rata-rata 12 kabupaten/kota",
    },
  ];

  // Map status messages
  const statusItems: MapStatusItem[] = [];
  if (filters.lapisan.includes("risiko")) {
    if (risk.error) statusItems.push({ kind: "error", message: `Gagal memuat prediksi risiko. ${risk.error}`, onRetry: risk.retry });
    else if (risk.loading) statusItems.push({ kind: "loading", message: "Memuat prediksi risiko…" });
  }
  if (filters.lapisan.includes("hotspot")) {
    if (hotspots.error) statusItems.push({ kind: "error", message: `Gagal memuat hotspot. ${hotspots.error}`, onRetry: hotspots.retry });
    else if (hotspots.loading) statusItems.push({ kind: "loading", message: "Memuat hotspot…" });
    else if (hotspotCount === 0) statusItems.push({ kind: "empty", message: "Tidak ada hotspot pada rentang ini" });
  }
  if (filters.lapisan.includes("zona") && clusters.error) {
    statusItems.push({ kind: "error", message: `Gagal memuat zona kebakaran. ${clusters.error}`, onRetry: clusters.retry });
  }

  const weatherBySlug = useMemo(
    () => Object.fromEntries((weather.data ?? []).map((w) => [w.slug, w.cuaca])),
    [weather.data],
  );

  const detail =
    selected?.kind === "cluster" ? (
      <ClusterDetail
        feature={selected.feature}
        regionName={regionName(selected.feature.properties.kabupaten)}
        onClose={() => setSelection(null)}
      />
    ) : selected?.kind === "cell" ? (
      <CellDetail
        feature={selected.feature}
        regionName={regionName(selected.feature.properties.kabupaten)}
        weather={weatherBySlug[selected.feature.properties.kabupaten]}
        onClose={() => setSelection(null)}
      />
    ) : null;

  const visibleLayers = filters.lapisan.filter((key) => LAYERS.some((layer) => layer.key === key));
  const sheetTitle =
    hotspotCount === undefined
      ? "Ringkasan"
      : `${formatInteger(hotspotCount)} hotspot · ${formatInteger(clusters.data?.features.length ?? 0)} zona aktif`;

  const topRegions = <TopRegions stats={regionStats.data} targetDate={targetDate} error={regionStats.error} />;

  return (
    <main className="flex h-[calc(100dvh-var(--header-h))] flex-col xl:gap-4 xl:p-4">
      <h1 className="sr-only">Peta pemantauan dan prediksi karhutla Riau</h1>

      <SummaryCards items={summary} className="hidden xl:grid" />

      <div className="relative min-h-0 flex-1 xl:grid xl:grid-cols-[288px_minmax(0,1fr)_352px] xl:gap-4">
        <aside aria-label="Filter dan lapisan" className="hidden min-h-0 overflow-y-auto xl:block">
          <Card>
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              toggleLayer={toggleLayer}
              layers={LAYERS}
              rangeHint={rangeHint}
            >
              <PredictionDaySlider
                baseDate={status.tanggal_data}
                value={filters.prediksi}
                onChange={(prediksi) => setFilters({ prediksi })}
              />
              <OpacitySlider value={riskOpacity} onChange={setRiskOpacity} />
            </FilterPanel>
          </Card>
        </aside>

        <div
          className="map-frame relative isolate h-full overflow-hidden xl:rounded-xl xl:border xl:border-border"
          style={{ ["--map-top-inset" as string]: "60px", ["--map-bottom-inset" as string]: "124px" }}
        >
          <DashboardMap
            label="Peta hotspot dan prediksi risiko karhutla Provinsi Riau"
            layers={filters.lapisan}
            hotspots={hotspots.data}
            clusters={clusters.data}
            risk={risk.data}
            boundaries={regions.data}
            riskOpacity={riskOpacity}
            regionNames={regionNames}
            selected={selected}
            onSelectCluster={(feature) => select({ kind: "cluster", id: feature.properties.id })}
            onSelectCell={(feature) => select({ kind: "cell", id: feature.properties.cell_id })}
          />

          <LayerChips
            layers={LAYERS}
            active={filters.lapisan}
            onToggle={toggleLayer}
            className="absolute inset-x-0 top-0 z-[800] xl:hidden"
          />

          {filters.lapisan.includes("risiko") ? (
            <p className="pointer-events-none absolute top-16 left-3 z-[800] rounded-lg border border-border bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm xl:top-3">
              <span className="block text-muted-foreground">Prediksi risiko</span>
              <span className="font-medium">
                <span className="font-mono">+{filters.prediksi}</span> hari · {formatDayShort(targetDate)}
              </span>
            </p>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-[7.5rem] z-[800] flex justify-center px-4 xl:top-3">
            <MapStatus items={statusItems} />
          </div>

          <MapLegend layers={visibleLayers} defaultOpen className="absolute bottom-6 left-3 z-[800] hidden xl:block" />
          <MapLegend
            layers={visibleLayers}
            defaultOpen={false}
            className="absolute bottom-[132px] left-3 z-[650] xl:hidden"
          />
        </div>

        <aside aria-label="Detail dan peringkat" className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
          <Card className="p-4">
            {detail ?? (
              <p className="text-sm text-muted-foreground">
                Klik kotak grid atau zona kebakaran di peta untuk melihat detail dan faktor risikonya.
              </p>
            )}
          </Card>
          <Card className="p-4">{topRegions}</Card>
        </aside>

        <BottomSheet
          className="xl:hidden"
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={sheetTitle}
          peek={
            <PredictionDayChips
              baseDate={status.tanggal_data}
              value={filters.prediksi}
              onChange={(prediksi) => setFilters({ prediksi })}
            />
          }
        >
          <div className="flex flex-col gap-5">
            {detail ? <div className="rounded-xl border border-border p-4">{detail}</div> : null}
            <SummaryCards items={summary} compact />
            {topRegions}
            <TimeRangeControl value={filters.rentang} onChange={(rentang) => setFilters({ rentang })} hint={rangeHint} />
            <ConfidenceControl value={filters.conf} onChange={(conf) => setFilters({ conf })} />
            <OpacitySlider value={riskOpacity} onChange={setRiskOpacity} />
            <LayerToggles layers={LAYERS} active={filters.lapisan} onToggle={toggleLayer} />
          </div>
        </BottomSheet>
      </div>
    </main>
  );
}
