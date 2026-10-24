"use client";

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import {
  ArrowRight,
  ChartColumn,
  Flame,
  Gauge,
  Hexagon,
  PanelLeftClose,
  PanelRightClose,
  SlidersHorizontal,
  SunDim,
  TriangleAlert,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { bboxContains, bboxIntersects, limitBBox, pointInBBox, ringBBox } from "@/lib/geo";
import { regionDisplayName, regionHref } from "@/lib/labels";
import { getRiskLabel, getRiskLevel } from "@/lib/risk";
import { prefetchJson, useJson } from "@/lib/use-json";
import { prefersReducedMotion, useIsDesktop, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  CLUSTER_STATUSES,
  CONFIDENCE_LEVELS,
  type BBox,
  type ClusterCollection,
  type DataStatus,
  type HotspotCollection,
  type ProvinceLineCollection,
  type Region,
  type RegionBoundaryCollection,
  type RegionIndexItem,
  type RegionStat,
  type RegionWeather,
  type RiskCellCollection,
  type RiskLevel,
} from "@/types";
import { bboxToBounds } from "./bounds";
import { FOCUS_REGION_EVENT } from "./focus-region";
import { BoundaryGlyph, HotspotGlyph, PeatGlyph, RiskGlyph, ZoneGlyph } from "./legend-icons";
import { MapControls } from "./map-controls";
import { MapLegend, MapLegendDrawer, type LegendCounts, type LegendHighlight, type LegendProps } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";
import { HOTSPOT_GROUP_LAYER } from "./hotspot-layers";
import { regionFillLayer } from "./region-layers";
import { selectionShape, type MapSelection, type SelectedFeature } from "./selection";
import { DEFAULT_RISK_OPACITY, REGENCY_MIN_ZOOM, tierOf } from "./styles";
import { useMapIdleValue } from "./use-map-idle";
import { PREDICTION_DAYS, useMapFilters } from "./use-map-filters";
import { snapBBox, useMapViewport } from "./use-map-viewport";

const DashboardMap = dynamic(() => import("./dashboard-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const LAYERS: LayerOption[] = [
  { key: "risiko", label: "Prediksi risiko", description: "Rata-rata wilayah, grid 5 km saat dekat", icon: <RiskGlyph /> },
  { key: "hotspot", label: "Hotspot", description: "Titik panas satelit", icon: <HotspotGlyph size={10} /> },
  { key: "zona", label: "Zona kebakaran", description: "Kelompok hotspot hari terakhir", icon: <ZoneGlyph /> },
  { key: "batas", label: "Batas wilayah", description: "Provinsi dan kabupaten/kota", icon: <BoundaryGlyph /> },
  { key: "gambut", label: "Lahan gambut", description: "Tampil saat peta diperbesar", icon: <PeatGlyph /> },
];

/** Largest bbox the grid endpoint accepts (square degrees). */
const MAX_GRID_AREA = 24;

/** Time each prediction day stays on screen while the timeline plays. */
const PLAY_STEP_MS = 1100;

const statsUrl = (level: "provinsi" | "kabupaten", query: string) => `/api/stats/regions?level=${level}&${query}`;
const riskUrl = (targetDate: string, bbox: string) => `/api/risk?target_date=${targetDate}&bbox=${bbox}`;

function sum<T>(items: T[], value: (item: T) => number) {
  return items.reduce((total, item) => total + value(item), 0);
}

function byKey<T extends { slug: string }>(items: T[] | undefined) {
  return items ? Object.fromEntries(items.map((item) => [item.slug, item])) : undefined;
}

export function MapDashboard({ status }: { status: DataStatus }) {
  const { filters, setFilters, toggleLayer } = useMapFilters();
  const desktop = useIsDesktop();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [riskOpacity, setRiskOpacity] = useState(DEFAULT_RISK_OPACITY);
  const [panelOpen, setPanelOpen] = useState(true);
  // `null` = automatic: the summary starts open only on wide screens, where it does not cover the map.
  const [summaryOpen, setSummaryOpen] = useState<boolean | null>(null);
  const summaryVisible = summaryOpen ?? wide;
  const [controlsOpen, setControlsOpen] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [onlyLevel, setOnlyLevel] = useState<RiskLevel | null>(null);
  const [legendHighlight, setLegendHighlight] = useState<LegendHighlight | null>(null);

  // Updated once the map has settled (moveend + 300 ms), never while it moves.
  const viewport = useMapViewport(map, 300);
  const zoom = viewport?.zoom ?? 5;
  const tier = tierOf(zoom);
  const near = tier === "dekat";

  const riskOn = filters.lapisan.includes("risiko");
  const hotspotsOn = filters.lapisan.includes("hotspot");
  const playing = playRequested && riskOn;

  const end = status.tanggal_data;
  const start = addDaysIso(end, -(filters.rentang - 1));
  const rangeHint = start === end ? formatDayShort(end) : `${formatDayShort(start)} – ${formatDayShort(end)}`;
  const targetDate = addDaysIso(status.tanggal_data, filters.prediksi);

  // Data -----------------------------------------------------------------------------------
  const hotspotQuery = `start=${start}&end=${end}&min_confidence=${filters.conf}`;
  const statsQuery = (date: string) => `date=${date}&${hotspotQuery}`;
  const index = useJson<RegionIndexItem[]>("/api/regions/list");
  const indexBySlug = useMemo(() => byKey(index.data), [index.data]);
  const focusItem = filters.wilayah ? (indexBySlug?.[filters.wilayah] ?? null) : null;

  // Regencies, their outlines, and province borders load once the map is zoomed to 6 or more
  // (or a regency is focused); afterwards they stay in memory.
  const [regenciesWanted, setRegenciesWanted] = useState(false);
  if (!regenciesWanted && (zoom >= REGENCY_MIN_ZOOM || (focusItem !== null && focusItem.level !== "provinsi"))) {
    setRegenciesWanted(true);
  }

  const provinces = useJson<RegionBoundaryCollection>("/api/regions?level=provinsi");
  const regencies = useJson<RegionBoundaryCollection>(regenciesWanted ? "/api/regions?level=kabupaten" : null);
  const provinceLines = useJson<ProvinceLineCollection>(regenciesWanted ? "/api/regions/lines" : null);
  const provinceStats = useJson<RegionStat[]>(statsUrl("provinsi", statsQuery(targetDate)));
  const regencyStats = useJson<RegionStat[]>(statsUrl("kabupaten", statsQuery(targetDate)));
  const clusters = useJson<ClusterCollection>(`/api/clusters?date=${end}`);
  const weather = useJson<RegionWeather[]>("/api/weather");

  // Hotspots of the whole country: the map groups them itself (clustered source). While the
  // layer is off nothing is requested and the last data stays on the (hidden) source.
  const hotspots = useJson<HotspotCollection>(hotspotsOn ? `/api/hotspots?${hotspotQuery}` : null);
  const hotspotFeatures = useMemo(() => hotspots.data?.features ?? [], [hotspots.data]);

  // Risk grid: only from zoom 8, for the settled view. The requested area is kept while the
  // view stays inside it, so small pans do not refetch; a new request aborts the previous one.
  const gridArea = near && viewport ? limitBBox(snapBBox(viewport.bbox, 0.5, 0.15), MAX_GRID_AREA) : null;
  const [gridBBox, setGridBBox] = useState<BBox | null>(null);
  if (gridArea && viewport && (!gridBBox || !bboxContains(gridBBox, viewport.bbox)) && gridArea.join() !== gridBBox?.join()) {
    setGridBBox(gridArea);
  }
  const gridQuery = near && gridBBox ? gridBBox.join(",") : null;
  const risk = useJson<RiskCellCollection>(gridQuery ? riskUrl(targetDate, gridQuery) : null);
  const riskData = near ? risk.data : undefined;

  // While playing, step to the next day once the current one has loaded and been shown.
  const tierLoading = near ? risk.loading : (tier === "provinsi" ? provinceStats : regencyStats).loading;
  useEffect(() => {
    if (!playing || tierLoading) return;
    const day = filters.prediksi;
    const timer = window.setTimeout(() => {
      if (day >= PREDICTION_DAYS.length) setPlayRequested(false);
      else setFilters({ prediksi: day + 1 });
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, tierLoading, filters.prediksi, setFilters]);

  const setPlaying = (next: boolean) => {
    if (next) {
      // Load every prediction day up front so playback does not stall between days.
      for (const day of PREDICTION_DAYS) {
        const date = addDaysIso(status.tanggal_data, day);
        const urls = [statsUrl("provinsi", statsQuery(date)), statsUrl("kabupaten", statsQuery(date))];
        if (gridQuery) urls.push(riskUrl(date, gridQuery));
        for (const url of urls) prefetchJson(url).catch(() => {});
      }
      if (filters.prediksi >= PREDICTION_DAYS.length) setFilters({ prediksi: 1 });
    }
    setPlayRequested(next);
  };

  // Regions --------------------------------------------------------------------------------
  const regionNames = useMemo(() => Object.fromEntries((index.data ?? []).map((r) => [r.slug, r.nama])), [index.data]);
  const regionName = (slug: string) => regionNames[slug] ?? slug;
  const provinceStatsBySlug = useMemo(() => byKey(provinceStats.data), [provinceStats.data]);
  const regencyStatsBySlug = useMemo(() => byKey(regencyStats.data), [regencyStats.data]);

  const fitPadding: PaddingOptions = desktop
    ? { top: 16, left: 324, right: summaryVisible ? 324 : 72, bottom: riskOn ? 150 : 16 }
    : { top: 64, left: 12, right: 12, bottom: riskOn ? 150 : 16 };
  const fitPaddingRef = useRef(fitPadding);
  useEffect(() => {
    fitPaddingRef.current = fitPadding;
  });

  // Zoom to a region: from a click on the map, the command palette, or `?wilayah=` on load.
  const pendingFlyRef = useRef<string | null>(filters.wilayah);
  const flyTo = (slug: string, animate = true) => {
    const item = indexBySlug?.[slug];
    if (!map || !item) {
      pendingFlyRef.current = slug;
      return;
    }
    pendingFlyRef.current = null;
    map.fitBounds(bboxToBounds(item.bbox), {
      padding: fitPaddingRef.current,
      maxZoom: item.level === "provinsi" ? 8 : 10,
      duration: animate && !prefersReducedMotion() ? 400 : 0,
    });
  };
  const flyToRef = useRef(flyTo);
  useEffect(() => {
    flyToRef.current = flyTo;
  });
  useEffect(() => {
    if (map && indexBySlug && pendingFlyRef.current) flyToRef.current(pendingFlyRef.current, false);
  }, [map, indexBySlug]);

  const focusRegion = (slug: string) => {
    setFilters({ wilayah: slug });
    flyTo(slug);
  };
  const focusRegionRef = useRef(focusRegion);
  useEffect(() => {
    focusRegionRef.current = focusRegion;
  });
  useEffect(() => {
    const onFocus = (event: Event) => focusRegionRef.current((event as CustomEvent<string>).detail);
    window.addEventListener(FOCUS_REGION_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_REGION_EVENT, onFocus);
  }, []);

  // The regency in the middle of the map (read from the rendered map once it is idle): the
  // summary describes it up close, and its province at regency zoom levels.
  const centerSlug = useMapIdleValue(map, (m) => {
    const layer = regionFillLayer("kabupaten");
    if (m.getZoom() < REGENCY_MIN_ZOOM || !m.getLayer(layer)) return null;
    const feature = m.queryRenderedFeatures(m.project(m.getCenter()), { layers: [layer] })[0];
    return feature ? String(feature.properties.slug) : null;
  });
  const centerRegion = useMemo((): Region | null => {
    if (tier === "provinsi" || !centerSlug) return null;
    const regency = indexBySlug?.[centerSlug];
    if (!regency) return null;
    return near ? regency : (indexBySlug?.[regency.provinsi ?? ""] ?? null);
  }, [tier, near, centerSlug, indexBySlug]);

  const context: Region | null = focusItem ?? centerRegion;
  const contextProvince = context ? (context.level === "provinsi" ? context.slug : context.provinsi) : null;
  const contextName = context ? regionDisplayName(context) : "Indonesia";
  const contextSource = focusItem ? "dipilih" : centerRegion ? "di tengah peta" : "seluruh wilayah";

  // Selection ------------------------------------------------------------------------------
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
      const feature = hotspotFeatures.find((f) => f.properties.id === selection.id);
      return feature ? { kind: "hotspot", feature } : null;
    }
    return null;
  }, [selection, clusters.data, risk.data, hotspotFeatures]);
  const selectedShape = useMemo(() => (selected ? selectionShape(selected) : null), [selected]);

  const weatherBySlug = useMemo(
    () => Object.fromEntries((weather.data ?? []).map((w) => [w.slug, w.cuaca])),
    [weather.data],
  );

  // Summary values for the context --------------------------------------------------------
  const statsLoaded = provinceStats.data !== undefined && regencyStats.data !== undefined;
  const contextStat = context
    ? (context.level === "provinsi" ? provinceStatsBySlug : regencyStatsBySlug)?.[context.slug]
    : undefined;
  const hotspotCount = !statsLoaded
    ? undefined
    : context
      ? (contextStat?.jumlah_hotspot ?? 0)
      : sum(provinceStats.data ?? [], (s) => s.jumlah_hotspot);
  // "Most hotspots": the province nationally, otherwise a regency of the province.
  const hotspotChildren = context
    ? (regencyStats.data ?? []).filter((s) => s.provinsi === contextProvince)
    : (provinceStats.data ?? []);
  const topHotspot =
    context?.level === "provinsi" || !context
      ? hotspotChildren.reduce<RegionStat | null>((best, s) => (!best || s.jumlah_hotspot > best.jumlah_hotspot ? s : best), null)
      : null;
  // Regencies ranked by risk within the context's province (or nationally).
  const riskCandidates = useMemo(
    () => (regencyStats.data ?? []).filter((s) => !contextProvince || s.provinsi === contextProvince),
    [regencyStats.data, contextProvince],
  );
  const mostAtRisk = riskCandidates[0];
  const contextZones = (clusters.data?.features ?? []).filter(
    (f) =>
      !context || (context.level === "provinsi" ? f.properties.provinsi === context.slug : f.properties.kabupaten === context.slug),
  );
  const zoneCount = (s: string) => contextZones.filter((f) => f.properties.status === s).length;
  const contextWeather = (weather.data ?? []).filter(
    (w) => !context || (context.level === "provinsi" ? w.provinsi === context.slug : w.slug === context.slug),
  );
  const avgDryDays = contextWeather.length ? sum(contextWeather, (w) => w.cuaca.hari_tanpa_hujan) / contextWeather.length : undefined;
  const regencyContext = context && context.level !== "provinsi";

  const stats: MapStat[] = [
    {
      label: `Hotspot ${RANGE_LABELS[filters.rentang]}`,
      icon: Flame,
      accent: true,
      value: hotspotCount,
      format: formatInteger,
      hint: topHotspot && topHotspot.jumlah_hotspot > 0 ? `Terbanyak ${topHotspot.nama}` : rangeHint,
    },
    {
      label: "Zona aktif",
      icon: Hexagon,
      value: clusters.data ? contextZones.length : undefined,
      format: formatInteger,
      hint: clusters.data ? `${zoneCount("baru")} baru · ${zoneCount("meluas")} meluas` : undefined,
    },
    regencyContext
      ? {
          label: "Rata-rata risiko",
          icon: Gauge,
          value: !statsLoaded ? undefined : (contextStat?.rata_skor_risiko ?? 0),
          format: (v: number) => formatDecimal(v),
          hint: contextStat
            ? `${getRiskLabel(getRiskLevel(contextStat.rata_skor_risiko))} · maks ${formatDecimal(contextStat.maks_skor_risiko)}`
            : undefined,
        }
      : {
          label: "Paling rawan",
          icon: TriangleAlert,
          value: !statsLoaded ? undefined : (mostAtRisk?.nama ?? "–"),
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
      hint: regencyContext ? "Cuaca terkini" : contextWeather.length ? `Rata-rata ${formatInteger(contextWeather.length)} kabupaten/kota` : undefined,
    },
  ];

  // Map status messages
  const statusItems: MapStatusItem[] = [];
  if (riskOn) {
    const tierStats = tier === "provinsi" ? provinceStats : regencyStats;
    if (near && risk.error) statusItems.push({ kind: "error", message: "Gagal memuat prediksi risiko.", onRetry: risk.retry });
    else if (near && risk.loading && !risk.data) statusItems.push({ kind: "loading", message: "Memuat kotak risiko…" });
    else if (!near && tierStats.error) {
      statusItems.push({ kind: "error", message: "Gagal memuat risiko wilayah.", onRetry: tierStats.retry });
    }
  }
  if (tier !== "provinsi" && regencies.error) {
    statusItems.push({ kind: "error", message: "Gagal memuat batas kabupaten/kota.", onRetry: regencies.retry });
  } else if (tier !== "provinsi" && regencies.loading && !regencies.data) {
    statusItems.push({ kind: "loading", message: "Memuat batas kabupaten/kota…" });
  }
  if (hotspotsOn) {
    if (hotspots.error) statusItems.push({ kind: "error", message: "Gagal memuat hotspot.", onRetry: hotspots.retry });
    else if (hotspots.loading && !hotspots.data) statusItems.push({ kind: "loading", message: "Memuat hotspot…" });
    else if (hotspotCount === 0) statusItems.push({ kind: "empty", message: `Tidak ada hotspot di ${contextName} pada rentang ini` });
  }
  if (filters.lapisan.includes("zona") && clusters.error) {
    statusItems.push({ kind: "error", message: "Gagal memuat zona kebakaran.", onRetry: clusters.retry });
  }
  if (filters.lapisan.includes("gambut") && !near) {
    statusItems.push({ kind: "empty", message: "Perbesar peta untuk melihat lahan gambut" });
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

  // Numbered hotspot groups on screen (the grouping happens inside the map).
  const groupCount = useMapIdleValue(map, (m) => {
    if (!m.getLayer(HOTSPOT_GROUP_LAYER)) return 0;
    const ids = new Set(m.queryRenderedFeatures({ layers: [HOTSPOT_GROUP_LAYER] }).map((f) => f.properties.cluster_id));
    return ids.size;
  });

  // Legend counts: objects inside the current view.
  const legendCounts = useMemo((): LegendCounts | undefined => {
    if (!viewport) return undefined;
    const view = viewport.bbox;
    const zeroLevels = (): Record<RiskLevel, number> => ({ rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 });
    const risk = zeroLevels();
    if (near) {
      for (const f of riskData?.features ?? []) {
        if (bboxIntersects(ringBBox(f.geometry.coordinates[0]), view)) risk[f.properties.level_risiko]++;
      }
    } else {
      const stats = tier === "provinsi" ? provinceStats.data : regencyStats.data;
      for (const s of stats ?? []) {
        const item = indexBySlug?.[s.slug];
        if (item && bboxIntersects(item.bbox, view)) risk[getRiskLevel(s.rata_skor_risiko)]++;
      }
    }
    const byConfidence = Object.fromEntries(CONFIDENCE_LEVELS.map((c) => [c, 0])) as Record<(typeof CONFIDENCE_LEVELS)[number], number>;
    let total = 0;
    for (const f of hotspotFeatures) {
      if (!pointInBBox(f.geometry.coordinates, view)) continue;
      byConfidence[f.properties.confidence]++;
      total++;
    }
    const zones = Object.fromEntries(CLUSTER_STATUSES.map((s) => [s, 0])) as Record<(typeof CLUSTER_STATUSES)[number], number>;
    for (const f of clusters.data?.features ?? []) {
      if (f.geometry.coordinates[0].some((p) => pointInBBox(p, view))) zones[f.properties.status]++;
    }
    const peat = (riskData?.features ?? []).filter(
      (f) => f.properties.is_gambut && pointInBBox(f.geometry.coordinates[0][0], view),
    ).length;
    return { risk, hotspots: { total, byConfidence, groups: groupCount ?? 0 }, zones, peat };
  }, [viewport, near, tier, riskData, provinceStats.data, regencyStats.data, indexBySlug, hotspotFeatures, groupCount, clusters.data]);

  const legendProps: LegendProps = {
    layers: visibleLayers,
    tier,
    counts: legendCounts,
    onlyLevel,
    onOnlyLevelChange: setOnlyLevel,
    onHighlight: setLegendHighlight,
    dataDate: status.tanggal_data,
    rangeLabel: RANGE_LABELS[filters.rentang],
    mock: status.sumber === "mock",
  };

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
  const topRegionsTitle = !contextProvince
    ? "5 kabupaten/kota paling rawan"
    : `Paling rawan di ${regionName(contextProvince)}`;
  const topRegions = (
    <section aria-labelledby="paling-rawan">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 id="paling-rawan" className="truncate text-xs font-medium text-muted-foreground">
          {topRegionsTitle}
        </h2>
        <span className="shrink-0 text-[11px] text-muted-foreground">{formatDayShort(targetDate)}</span>
      </div>
      <TopRegions
        stats={regencyStats.data ? riskCandidates : undefined}
        highlight={regencyContext ? context.slug : null}
        error={regencyStats.error}
        onRetry={regencyStats.retry}
      />
    </section>
  );
  const summaryHeading = (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold tracking-tight">{contextName}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        Ringkasan {contextSource} · {rangeHint}
      </p>
    </div>
  );

  return (
    <main
      className="relative isolate h-[calc(100dvh-var(--header-h))] overflow-hidden"
      style={{ ["--map-bottom-inset" as string]: riskOn ? "128px" : "0px" }}
    >
      <h1 className="sr-only">Peta pemantauan dan prediksi karhutla Indonesia</h1>

      <div className="map-frame absolute inset-0">
        <DashboardMap
          label="Peta hotspot dan prediksi risiko karhutla Indonesia"
          tier={tier}
          layers={filters.lapisan}
          provinces={provinces.data}
          regencies={regencies.data}
          provinceLines={provinceLines.data}
          provinceStats={provinceStatsBySlug}
          regencyStats={regencyStatsBySlug}
          hotspots={hotspots.data}
          clusters={clusters.data}
          risk={riskData}
          riskOpacity={riskOpacity}
          regionNames={regionNames}
          selected={selectedShape}
          focusSlug={focusItem ? focusItem.slug : null}
          focusLevel={focusItem ? (focusItem.level === "provinsi" ? "provinsi" : "kabupaten") : null}
          onlyLevel={riskOn ? onlyLevel : null}
          highlight={legendHighlight}
          fitPadding={fitPadding}
          onReady={setMap}
          onSelectCluster={(id) => setSelection({ kind: "cluster", id })}
          onSelectCell={(id) => setSelection({ kind: "cell", id })}
          onSelectHotspot={(id) => setSelection({ kind: "hotspot", id })}
          onSelectRegion={focusRegion}
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
        <MapLegend {...legendProps} defaultOpen className="pointer-events-auto mt-auto min-h-0 shrink" />
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
                {summaryHeading}
                <Button variant="ghost" size="icon-sm" aria-label="Ciutkan ringkasan" onClick={() => setSummaryOpen(false)}>
                  <PanelRightClose />
                </Button>
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
        {/* Focusable so keyboard users can scroll the strip. */}
        <ul
          aria-label={`Ringkasan singkat ${contextName}`}
          tabIndex={0}
          className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto rounded-xl"
        >
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

      {/* Focused region (with a link to its page) and status pills, centered over the map. */}
      <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-[600] flex flex-col items-center gap-2 px-4 lg:top-3 lg:left-[324px] lg:right-[324px]">
        <AnimatePresence initial={false}>
          {focusItem ? (
            <motion.div
              key={focusItem.slug}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="glass-panel pointer-events-auto flex max-w-full items-center gap-1 rounded-full py-1 pr-1 pl-3.5 text-[13px]"
            >
              <span className="min-w-0 truncate font-medium">{regionDisplayName(focusItem)}</span>
              <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 rounded-full px-2.5 text-ember-ink pointer-coarse:h-11">
                <Link href={regionHref(focusItem)}>
                  Halaman wilayah <ArrowRight />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus fokus ${regionDisplayName(focusItem)}`}
                onClick={() => setFilters({ wilayah: null })}
                className="shrink-0 rounded-full"
              >
                <X />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <MapStatus items={statusItems} />
      </div>

      <MapControls
        map={map}
        padding={fitPadding}
        className={cn(
          "absolute z-[500] transition-[right] duration-300",
          "top-[4.25rem] right-3 lg:top-auto lg:bottom-8",
          desktop && detail ? "lg:right-[424px]" : "lg:right-3",
        )}
      />

      {/* Mobile: the legend opens in a drawer from a button above the timeline. */}
      <div className={cn("absolute left-3 z-[500] lg:hidden", riskOn ? "bottom-[8.5rem]" : "bottom-3")}>
        <MapLegendDrawer {...legendProps} />
      </div>

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
              loading={tierLoading}
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
            <DrawerDescription className="text-xs">
              {contextName} · {rangeHint}
            </DrawerDescription>
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
              {summaryHeading}
              <MapStats items={stats} />
              {topRegions}
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
