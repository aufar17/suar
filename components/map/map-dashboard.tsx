"use client";

import type L from "leaflet";
import { ChartColumn, Flame, Hexagon, PanelLeftClose, PanelRightClose, SlidersHorizontal, SunDim, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { FilterControls, RANGE_LABELS, type LayerOption } from "@/components/filters/filter-panel";
import { PredictionTimeline } from "@/components/filters/prediction-day";
import { ClusterDetail, DetailPanel, HotspotDetail } from "@/components/panels/detail-panel";
import { MapStats, type MapStat } from "@/components/panels/map-stats";
import { CellDetail } from "@/components/panels/risk-detail";
import { TopRegions } from "@/components/panels/top-regions";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";
import { prefetchJson, useJson } from "@/lib/use-json";
import { useIsDesktop, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
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
import { MapControls } from "./map-controls";
import { MapLegend } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";
import type { MapSelection, SelectedFeature } from "./selection";
import { PREDICTION_DAYS, useMapFilters } from "./use-map-filters";

const DashboardMap = dynamic(() => import("./dashboard-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const LAYERS: LayerOption[] = [
  { key: "risiko", label: "Prediksi risiko", description: "Grid 5 km, skor 0–1", icon: <RiskGlyph /> },
  { key: "hotspot", label: "Hotspot", description: "Titik panas satelit", icon: <HotspotGlyph size={10} /> },
  { key: "zona", label: "Zona kebakaran", description: "Kelompok hotspot hari terakhir", icon: <ZoneGlyph /> },
  { key: "batas", label: "Batas wilayah", description: "Kabupaten/kota", icon: <BoundaryGlyph /> },
  { key: "gambut", label: "Lahan gambut", description: "Sebaran gambut per kotak grid", icon: <PeatGlyph /> },
];

/** Time each prediction day stays on screen while the timeline plays. */
const PLAY_STEP_MS = 1100;

function riskUrl(targetDate: string) {
  return `/api/risk?target_date=${targetDate}`;
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

export function MapDashboard({ status }: { status: DataStatus }) {
  const { filters, setFilters, toggleLayer } = useMapFilters();
  const desktop = useIsDesktop();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [map, setMap] = useState<L.Map | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [riskOpacity, setRiskOpacity] = useState(0.7);
  const [panelOpen, setPanelOpen] = useState(true);
  // `null` = automatic: the summary starts open only on wide screens, where it does not cover the map.
  const [summaryOpen, setSummaryOpen] = useState<boolean | null>(null);
  const summaryVisible = summaryOpen ?? wide;
  const [controlsOpen, setControlsOpen] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);

  const riskOn = filters.lapisan.includes("risiko");
  const playing = playRequested && riskOn;

  const end = status.tanggal_data;
  const start = addDaysIso(end, -(filters.rentang - 1));
  const rangeHint = start === end ? formatDayShort(end) : `${formatDayShort(start)} – ${formatDayShort(end)}`;
  const targetDate = addDaysIso(status.tanggal_data, filters.prediksi);

  const hotspots = useJson<HotspotCollection>(`/api/hotspots?start=${start}&end=${end}&min_confidence=${filters.conf}`);
  const clusters = useJson<ClusterCollection>(`/api/clusters?date=${end}`);
  const risk = useJson<RiskCellCollection>(riskUrl(targetDate));
  const regionStats = useJson<RegionStat[]>(`/api/stats/regions?date=${targetDate}`);
  const regions = useJson<RegionBoundaryCollection>("/api/regions");
  const weather = useJson<RegionWeather[]>("/api/weather");

  // While playing, step to the next day once the current one has loaded and been shown.
  useEffect(() => {
    if (!playing || risk.loading) return;
    const day = filters.prediksi;
    const timer = window.setTimeout(() => {
      if (day >= PREDICTION_DAYS.length) setPlayRequested(false);
      else setFilters({ prediksi: day + 1 });
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, risk.loading, filters.prediksi, setFilters]);

  const setPlaying = (next: boolean) => {
    if (next) {
      // Load every prediction day up front so playback does not stall between days.
      for (const day of PREDICTION_DAYS) prefetchJson(riskUrl(addDaysIso(status.tanggal_data, day))).catch(() => {});
      if (filters.prediksi >= PREDICTION_DAYS.length) setFilters({ prediksi: 1 });
    }
    setPlayRequested(next);
  };

  const regionNames = useMemo(
    () => Object.fromEntries((regions.data?.features ?? []).map((f) => [f.properties.slug, f.properties.nama])),
    [regions.data],
  );
  const regionName = (slug: string) => regionNames[slug] ?? slug;

  const selected = useMemo((): SelectedFeature | null => {
    if (selection?.kind === "cluster") {
      const feature = clusters.data?.features.find((f) => f.properties.id === selection.id);
      return feature ? { kind: "cluster", feature } : null;
    }
    if (selection?.kind === "cell") {
      const feature = risk.data?.features.find((f) => f.properties.cell_id === selection.id);
      return feature ? { kind: "cell", feature } : null;
    }
    if (selection?.kind === "hotspot") {
      const feature = hotspots.data?.features.find((f) => f.properties.id === selection.id);
      return feature ? { kind: "hotspot", feature } : null;
    }
    return null;
  }, [selection, clusters.data, risk.data, hotspots.data]);

  const weatherBySlug = useMemo(
    () => Object.fromEntries((weather.data ?? []).map((w) => [w.slug, w.cuaca])),
    [weather.data],
  );

  // Summary values
  const hotspotCount = hotspots.loading ? undefined : hotspots.data?.features.length;
  const topHotspotRegion = useMemo(() => {
    const counts = countBy(hotspots.data?.features ?? [], (f) => f.properties.kabupaten);
    const [slug, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return slug ? { slug, count: count ?? 0 } : null;
  }, [hotspots.data]);
  const mostAtRisk = regionStats.data?.[0];
  const avgDryDays = weather.data?.length
    ? weather.data.reduce((sum, w) => sum + w.cuaca.hari_tanpa_hujan, 0) / weather.data.length
    : undefined;
  const zoneCount = (s: string) => clusters.data?.features.filter((f) => f.properties.status === s).length ?? 0;

  const stats: MapStat[] = [
    {
      label: `Hotspot ${RANGE_LABELS[filters.rentang]}`,
      icon: Flame,
      accent: true,
      value: hotspotCount,
      format: formatInteger,
      hint: topHotspotRegion ? `Terbanyak ${regionName(topHotspotRegion.slug)}` : rangeHint,
    },
    {
      label: "Zona aktif",
      icon: Hexagon,
      value: clusters.data?.features.length,
      format: formatInteger,
      hint: clusters.data ? `${zoneCount("baru")} baru · ${zoneCount("meluas")} meluas` : undefined,
    },
    {
      label: "Paling rawan",
      icon: TriangleAlert,
      value: regionStats.loading && !regionStats.data ? undefined : (mostAtRisk?.nama ?? "–"),
      hint: mostAtRisk
        ? `${formatDecimal(mostAtRisk.rata_skor_risiko)} · ${getRiskLabel(getRiskLevel(mostAtRisk.rata_skor_risiko))}`
        : undefined,
    },
    {
      label: "Hari tanpa hujan",
      icon: SunDim,
      value: avgDryDays,
      format: (v) => formatDecimal(v, 1),
      unit: "hari",
      hint: "Rata-rata 12 wilayah",
    },
  ];

  // Map status messages
  const statusItems: MapStatusItem[] = [];
  if (riskOn) {
    if (risk.error) statusItems.push({ kind: "error", message: "Gagal memuat prediksi risiko.", onRetry: risk.retry });
    else if (risk.loading && !risk.data) statusItems.push({ kind: "loading", message: "Memuat prediksi risiko…" });
  }
  if (filters.lapisan.includes("hotspot")) {
    if (hotspots.error) statusItems.push({ kind: "error", message: "Gagal memuat hotspot.", onRetry: hotspots.retry });
    else if (hotspots.loading) statusItems.push({ kind: "loading", message: "Memuat hotspot…" });
    else if (hotspotCount === 0) statusItems.push({ kind: "empty", message: "Tidak ada hotspot pada rentang ini" });
  }
  if (filters.lapisan.includes("zona") && clusters.error) {
    statusItems.push({ kind: "error", message: "Gagal memuat zona kebakaran.", onRetry: clusters.retry });
  }

  const detail =
    selected?.kind === "cluster"
      ? {
          eyebrow: `Zona kebakaran · ${selected.feature.properties.id}`,
          title: regionName(selected.feature.properties.kabupaten),
          body: <ClusterDetail feature={selected.feature} regionName={regionName(selected.feature.properties.kabupaten)} />,
        }
      : selected?.kind === "cell"
        ? {
            eyebrow: `Kotak grid ${selected.feature.properties.cell_id} · 5×5 km`,
            title: regionName(selected.feature.properties.kabupaten),
            body: (
              <CellDetail
                feature={selected.feature}
                regionName={regionName(selected.feature.properties.kabupaten)}
                weather={weatherBySlug[selected.feature.properties.kabupaten]}
              />
            ),
          }
        : selected?.kind === "hotspot"
          ? {
              eyebrow: "Hotspot",
              title: regionName(selected.feature.properties.kabupaten),
              body: <HotspotDetail feature={selected.feature} regionName={regionName(selected.feature.properties.kabupaten)} />,
            }
          : null;

  const visibleLayers = filters.lapisan.filter((key) => LAYERS.some((layer) => layer.key === key));
  const fitPadding: L.FitBoundsOptions = desktop
    ? { paddingTopLeft: [324, 16], paddingBottomRight: [summaryVisible ? 324 : 72, riskOn ? 150 : 16] }
    : { paddingTopLeft: [12, 64], paddingBottomRight: [12, riskOn ? 150 : 16] };

  const controls = (
    <FilterControls
      filters={filters}
      setFilters={setFilters}
      toggleLayer={toggleLayer}
      layers={LAYERS}
      rangeHint={rangeHint}
      riskOpacity={riskOpacity}
      onRiskOpacityChange={setRiskOpacity}
    />
  );
  const topRegions = (
    <section aria-labelledby="paling-rawan">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 id="paling-rawan" className="text-xs font-medium text-muted-foreground">
          5 kabupaten paling rawan
        </h2>
        <span className="text-[11px] text-muted-foreground">{formatDayShort(targetDate)}</span>
      </div>
      <TopRegions stats={regionStats.data} error={regionStats.error} onRetry={regionStats.retry} />
    </section>
  );

  return (
    <main
      className="relative isolate h-[calc(100dvh-var(--header-h))] overflow-hidden"
      style={{ ["--map-bottom-inset" as string]: riskOn ? "128px" : "0px" }}
    >
      <h1 className="sr-only">Peta pemantauan dan prediksi karhutla Riau</h1>

      <div className="map-frame absolute inset-0">
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
          fitPadding={fitPadding}
          onReady={setMap}
          onSelectCluster={(feature) => setSelection({ kind: "cluster", id: feature.properties.id })}
          onSelectCell={(feature) => setSelection({ kind: "cell", id: feature.properties.cell_id })}
          onSelectHotspot={(feature) => setSelection({ kind: "hotspot", id: feature.properties.id })}
        />
      </div>

      {/* Desktop: filter panel (collapsible) and legend on the left. */}
      <div className="pointer-events-none absolute inset-y-3 left-3 z-[500] hidden w-[300px] flex-col items-start gap-3 lg:flex">
        <AnimatePresence initial={false} mode="popLayout">
          {panelOpen ? (
            <motion.aside
              key="panel"
              aria-label="Filter dan lapisan"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="glass-panel pointer-events-auto flex max-h-full min-h-0 w-full flex-col rounded-2xl"
            >
              <div className="flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
                <h2 className="text-sm font-semibold tracking-tight">Filter &amp; lapisan</h2>
                <Button variant="ghost" size="icon-sm" aria-label="Ciutkan panel filter" onClick={() => setPanelOpen(false)}>
                  <PanelLeftClose />
                </Button>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain p-4">{controls}</div>
            </motion.aside>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
            >
              <Button
                variant="outline"
                onClick={() => setPanelOpen(true)}
                aria-label="Buka panel filter dan lapisan"
                className="glass-panel h-10 rounded-xl"
              >
                <SlidersHorizontal />
                Filter &amp; lapisan
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular-nums">{visibleLayers.length}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <MapLegend layers={visibleLayers} defaultOpen className="pointer-events-auto mt-auto shrink-0" />
      </div>

      {/* Desktop: summary on the right (collapsible). */}
      <div className="pointer-events-none absolute top-3 right-3 z-[500] hidden w-[300px] flex-col items-end lg:flex">
        <AnimatePresence initial={false} mode="popLayout">
          {summaryVisible ? (
            <motion.aside
              key="summary"
              aria-label="Ringkasan"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="glass-panel pointer-events-auto flex w-full flex-col gap-4 rounded-2xl p-3"
            >
              <div className="-my-1 flex items-center justify-between gap-2 pl-1">
                <h2 className="text-sm font-semibold tracking-tight">Ringkasan</h2>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{rangeHint}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Ciutkan ringkasan" onClick={() => setSummaryOpen(false)}>
                    <PanelRightClose />
                  </Button>
                </div>
              </div>
              <MapStats items={stats} />
              <div className="px-1">{topRegions}</div>
            </motion.aside>
          ) : (
            <motion.div
              key="summary-collapsed"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
            >
              <Button
                variant="outline"
                onClick={() => setSummaryOpen(true)}
                aria-label="Buka ringkasan"
                className="glass-panel h-10 rounded-xl"
              >
                <ChartColumn />
                Ringkasan
                {hotspotCount !== undefined ? (
                  <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular-nums">
                    {formatInteger(hotspotCount)} hotspot
                  </span>
                ) : null}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: filter button and a scrollable strip of key numbers. */}
      <div className="absolute inset-x-3 top-3 z-[500] flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          onClick={() => setControlsOpen(true)}
          className="glass-panel h-11 shrink-0 rounded-xl px-3"
          aria-label="Buka filter, lapisan, dan ringkasan"
        >
          <SlidersHorizontal />
          <span className="font-mono text-[11px] tabular-nums">{visibleLayers.length}</span>
        </Button>
        <ul aria-label="Ringkasan singkat" className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {stats.slice(0, 3).map((stat) => (
            <li
              key={stat.label}
              className="glass-panel flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs whitespace-nowrap"
            >
              {stat.icon ? <stat.icon aria-hidden="true" className={cn("size-3.5", stat.accent && "text-ember-ink")} /> : null}
              <span className="font-semibold">
                {stat.value === undefined
                  ? "…"
                  : typeof stat.value === "number"
                    ? (stat.format ?? String)(stat.value)
                    : stat.value}
              </span>
              <span className="text-muted-foreground">{stat.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <MapStatus
        items={statusItems}
        className="absolute inset-x-0 top-[4.25rem] z-[600] px-4 lg:top-3 lg:left-[324px] lg:right-[324px]"
      />

      <MapControls
        map={map}
        padding={fitPadding}
        className={cn(
          "absolute z-[500] transition-[right] duration-300",
          "top-[4.25rem] right-3 lg:top-auto lg:bottom-8",
          desktop && detail ? "lg:right-[424px]" : "lg:right-3",
        )}
      />

      {/* Mobile legend sits above the timeline. */}
      <MapLegend
        layers={visibleLayers}
        defaultOpen={false}
        className={cn("absolute left-3 z-[500] w-auto max-w-[min(15rem,calc(100%-1.5rem))] lg:hidden", riskOn ? "bottom-[8.5rem]" : "bottom-3")}
      />

      <AnimatePresence>
        {riskOn ? (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute inset-x-3 bottom-3 z-[500] flex justify-center transition-[right] duration-300 lg:left-[calc(15rem+1.5rem)]",
              // Leave room for the map controls, which move left of the detail sheet when it is open.
              desktop && detail ? "lg:right-[488px]" : "lg:right-[4.5rem]",
            )}
          >
            <PredictionTimeline
              baseDate={status.tanggal_data}
              value={filters.prediksi}
              onChange={(prediksi) => setFilters({ prediksi })}
              playing={playing}
              onPlayingChange={setPlaying}
              loading={risk.loading}
              className="w-full max-w-[560px]"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DetailPanel
        open={detail !== null}
        onClose={() => setSelection(null)}
        desktop={desktop}
        eyebrow={detail?.eyebrow ?? ""}
        title={detail?.title ?? ""}
      >
        {detail?.body}
      </DetailPanel>

      {/* Mobile: filters, layers, and summary in a drawer. */}
      <Drawer open={controlsOpen && !desktop} onOpenChange={setControlsOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 text-left">
            <DrawerTitle>Peta karhutla</DrawerTitle>
            <DrawerDescription className="text-xs">{rangeHint}</DrawerDescription>
          </DrawerHeader>
          <Tabs defaultValue="filter" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 grid w-auto grid-cols-2">
              <TabsTrigger value="filter">Filter &amp; lapisan</TabsTrigger>
              <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
            </TabsList>
            <TabsContent value="filter" className="min-h-0 overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {controls}
            </TabsContent>
            <TabsContent
              value="ringkasan"
              className="flex min-h-0 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <MapStats items={stats} />
              {topRegions}
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
