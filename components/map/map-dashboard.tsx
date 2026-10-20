"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ConfidenceControl, FilterPanel, LayerToggles, RANGE_LABELS, TimeRangeControl, type LayerOption } from "@/components/filters/filter-panel";
import { LayerChips } from "@/components/filters/layer-chips";
import { BottomSheet } from "@/components/panels/bottom-sheet";
import { SummaryCards, type SummaryItem } from "@/components/panels/summary-cards";
import { Card } from "@/components/ui/card";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { useJson } from "@/lib/use-json";
import type { ClusterCollection, DataStatus, HotspotCollection, RegionBoundaryCollection, RegionWeather } from "@/types";
import { HotspotGlyph } from "./legend-icons";
import { MapLegend } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";
import { useMapFilters } from "./use-map-filters";

const DashboardMap = dynamic(() => import("./dashboard-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const LAYERS: LayerOption[] = [
  { key: "hotspot", label: "Hotspot", description: "Titik panas satelit", icon: <HotspotGlyph size={10} /> },
];

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

export function MapDashboard({ status }: { status: DataStatus }) {
  const { filters, setFilters, toggleLayer } = useMapFilters();
  const [sheetOpen, setSheetOpen] = useState(false);

  const end = status.tanggal_data;
  const start = addDaysIso(end, -(filters.rentang - 1));
  const rangeHint = start === end ? formatDayShort(end) : `${formatDayShort(start)} – ${formatDayShort(end)}`;

  const hotspots = useJson<HotspotCollection>(`/api/hotspots?start=${start}&end=${end}&min_confidence=${filters.conf}`);
  const clusters = useJson<ClusterCollection>(`/api/clusters?date=${end}`);
  const regions = useJson<RegionBoundaryCollection>("/api/regions");
  const weather = useJson<RegionWeather[]>("/api/weather");

  const regionNames = useMemo(
    () => Object.fromEntries((regions.data?.features ?? []).map((f) => [f.properties.slug, f.properties.nama])),
    [regions.data],
  );

  const hotspotCount = hotspots.loading ? undefined : hotspots.data?.features.length;
  const topHotspotRegion = useMemo(() => {
    const counts = countBy(hotspots.data?.features ?? [], (f) => f.properties.kabupaten);
    const [slug, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return slug ? { slug, count: count ?? 0 } : null;
  }, [hotspots.data]);
  const avgDryDays = weather.data?.length
    ? weather.data.reduce((sum, w) => sum + w.cuaca.hari_tanpa_hujan, 0) / weather.data.length
    : undefined;

  const summary: SummaryItem[] = [
    {
      label: `Hotspot ${RANGE_LABELS[filters.rentang]} terakhir`,
      value: hotspotCount === undefined ? undefined : formatInteger(hotspotCount),
      hint: rangeHint,
    },
    {
      label: "Zona kebakaran aktif",
      value: clusters.data ? formatInteger(clusters.data.features.length) : undefined,
      hint: clusters.data
        ? `${clusters.data.features.filter((f) => f.properties.status === "baru").length} baru, ${clusters.data.features.filter((f) => f.properties.status === "meluas").length} meluas`
        : undefined,
    },
    {
      label: "Hotspot terbanyak",
      mono: false,
      value: hotspots.data ? (topHotspotRegion ? (regionNames[topHotspotRegion.slug] ?? "…") : "–") : undefined,
      hint: topHotspotRegion ? `${formatInteger(topHotspotRegion.count)} hotspot` : undefined,
    },
    {
      label: "Rata-rata hari tanpa hujan",
      value: avgDryDays === undefined ? undefined : `${formatDecimal(avgDryDays, 1)} hari`,
      hint: "Rata-rata 12 kabupaten/kota",
    },
  ];

  const statusItems: MapStatusItem[] = [];
  if (filters.lapisan.includes("hotspot")) {
    if (hotspots.error) statusItems.push({ kind: "error", message: `Gagal memuat hotspot. ${hotspots.error}`, onRetry: hotspots.retry });
    else if (hotspots.loading) statusItems.push({ kind: "loading", message: "Memuat hotspot…" });
    else if (hotspotCount === 0) statusItems.push({ kind: "empty", message: "Tidak ada hotspot pada rentang ini" });
  }

  const visibleLayers = filters.lapisan.filter((key) => LAYERS.some((layer) => layer.key === key));

  const sheetTitle =
    hotspotCount === undefined
      ? "Ringkasan"
      : `${formatInteger(hotspotCount)} hotspot · ${formatInteger(clusters.data?.features.length ?? 0)} zona aktif`;

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
            />
          </Card>
        </aside>

        <div
          className="map-frame relative isolate h-full overflow-hidden xl:rounded-card xl:border xl:border-line"
          style={{ ["--map-top-inset" as string]: "60px", ["--map-bottom-inset" as string]: "56px" }}
        >
          <DashboardMap
            label="Peta hotspot dan risiko karhutla Provinsi Riau"
            layers={filters.lapisan}
            hotspots={hotspots.data}
            regionNames={regionNames}
          />

          <LayerChips
            layers={LAYERS}
            active={filters.lapisan}
            onToggle={toggleLayer}
            className="absolute inset-x-0 top-0 z-[800] xl:hidden"
          />

          <div className="absolute inset-x-0 top-16 z-[800] flex justify-center px-4 xl:top-3">
            <MapStatus items={statusItems} />
          </div>

          <MapLegend layers={visibleLayers} defaultOpen className="absolute bottom-6 left-3 z-[800] hidden xl:block" />
          <MapLegend layers={visibleLayers} defaultOpen={false} className="absolute bottom-16 left-3 z-[650] xl:hidden" />
        </div>

        <aside aria-label="Detail" className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
          <Card className="p-4">
            <p className="text-sm text-fg-muted">Klik kotak grid di peta untuk melihat detail risiko.</p>
          </Card>
        </aside>

        <BottomSheet className="xl:hidden" open={sheetOpen} onOpenChange={setSheetOpen} title={sheetTitle}>
          <div className="flex flex-col gap-5">
            <SummaryCards items={summary} compact />
            <TimeRangeControl value={filters.rentang} onChange={(rentang) => setFilters({ rentang })} hint={rangeHint} />
            <ConfidenceControl value={filters.conf} onChange={(conf) => setFilters({ conf })} />
            <LayerToggles layers={LAYERS} active={filters.lapisan} onToggle={toggleLayer} />
          </div>
        </BottomSheet>
      </div>
    </main>
  );
}
