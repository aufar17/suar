"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/use-json";
import type { BBox, RegionIndexItem, RegionStat, RiskGrid } from "@/types";
import { GEO_FILES } from "./geo-files";
import { HotspotGlyph } from "./legend-icons";
import { MapControls } from "./map-controls";
import { MapLegend } from "./map-legend";
import { HOTSPOT_SOURCE, regionSource } from "./map-queries";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";
import { useSourceStatus } from "./use-source-status";

const RegionMap = dynamic(() => import("./region-map"), { ssr: false, loading: () => <MapSkeleton /> });

/** Fetches region data from the API and renders the region map with its controls and legend. */
export function RegionMapPanel({
  slug,
  name,
  kind,
  provinsi,
  bbox,
  hotspotStart,
  hotspotEnd,
  targetDate,
}: {
  slug: string;
  name: string;
  kind: "provinsi" | "kabupaten";
  /** Province of the region (its own slug for a province). */
  provinsi: string;
  bbox: BBox;
  hotspotStart: string;
  hotspotEnd: string;
  targetDate: string;
}) {
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const area = kind === "provinsi" ? `provinsi=${slug}` : `kabupaten=${slug}`;
  const hotspotUrl = `/api/hotspots?start=${hotspotStart}&end=${hotspotEnd}&${area}`;
  const hotspots = useSourceStatus(map, HOTSPOT_SOURCE, hotspotUrl);
  const boundaries = useSourceStatus(map, regionSource("kabupaten"), GEO_FILES.kabupaten);
  const grid = useJson<RiskGrid>(kind === "kabupaten" ? `/api/risk/grid?${area}` : null);
  const index = useJson<RegionIndexItem[]>("/api/regions/list");
  const stats = useJson<RegionStat[]>(
    kind === "provinsi" ? `/api/stats/regions?level=kabupaten&provinsi=${slug}&date=${targetDate}` : null,
  );

  const regionNames = useMemo(() => Object.fromEntries((index.data ?? []).map((r) => [r.slug, r.nama])), [index.data]);
  const statsBySlug = useMemo(() => stats.data && Object.fromEntries(stats.data.map((s) => [s.slug, s])), [stats.data]);

  const status: MapStatusItem[] = [];
  if (hotspots.error) status.push({ kind: "error", message: "Gagal memuat hotspot.", onRetry: hotspots.retry });
  if (grid.error) status.push({ kind: "error", message: "Gagal memuat prediksi risiko.", onRetry: grid.retry });
  if (stats.error) status.push({ kind: "error", message: "Gagal memuat skor wilayah.", onRetry: stats.retry });
  if (boundaries.error) status.push({ kind: "error", message: "Gagal memuat batas wilayah.", onRetry: boundaries.retry });
  if (hotspots.loading || grid.loading || stats.loading || boundaries.loading) {
    status.push({ kind: "loading", message: "Memuat peta…" });
  }

  return (
    <div className="map-frame relative isolate h-[360px] overflow-hidden rounded-2xl border bg-muted sm:h-[460px]">
      <RegionMap
        slug={slug}
        name={name}
        kind={kind}
        provinsi={provinsi}
        bbox={bbox}
        hotspots={hotspotUrl}
        grid={grid.data}
        targetDate={targetDate}
        stats={statsBySlug}
        regionNames={regionNames}
        onReady={setMap}
      />
      <p className="glass-panel absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
        <HotspotGlyph size={8} /> Hotspot 7 hari · {kind === "provinsi" ? "rata-rata risiko besok" : "risiko besok"}
      </p>
      <MapStatus items={status} className="absolute inset-x-0 top-14 z-[600] px-4" />
      <MapControls map={map} home={bbox} homeLabel={`Kembali ke ${name}`} className="absolute top-3 right-3 z-[500]" />
      <MapLegend
        layers={["risiko", "hotspot", "batas"]}
        tier={kind === "provinsi" ? "kabupaten" : "dekat"}
        rangeLabel="7 hari"
        defaultOpen={false}
        className="absolute bottom-12 left-3 z-[500] w-56 sm:bottom-3"
      />
    </div>
  );
}
