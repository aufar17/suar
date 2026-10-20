"use client";

import type L from "leaflet";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/use-json";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RiskCellCollection } from "@/types";
import { HotspotGlyph } from "./legend-icons";
import { MapControls } from "./map-controls";
import { MapLegend } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";

const RegionMap = dynamic(() => import("./region-map"), { ssr: false, loading: () => <MapSkeleton /> });

/** Fetches region data from the API and renders the region map with its controls and legend. */
export function RegionMapPanel({
  slug,
  name,
  bbox,
  hotspotStart,
  hotspotEnd,
  targetDate,
}: {
  slug: string;
  name: string;
  bbox: BBox;
  hotspotStart: string;
  hotspotEnd: string;
  targetDate: string;
}) {
  const [map, setMap] = useState<L.Map | null>(null);
  const box = bbox.join(",");
  const hotspots = useJson<HotspotCollection>(`/api/hotspots?start=${hotspotStart}&end=${hotspotEnd}&bbox=${box}`);
  const risk = useJson<RiskCellCollection>(`/api/risk?target_date=${targetDate}&bbox=${box}`);
  const boundaries = useJson<RegionBoundaryCollection>("/api/regions");

  const regionHotspots = useMemo(
    () => hotspots.data && { ...hotspots.data, features: hotspots.data.features.filter((f) => f.properties.kabupaten === slug) },
    [hotspots.data, slug],
  );
  const regionNames = useMemo(
    () => Object.fromEntries((boundaries.data?.features ?? []).map((f) => [f.properties.slug, f.properties.nama])),
    [boundaries.data],
  );

  const status: MapStatusItem[] = [];
  if (hotspots.error) status.push({ kind: "error", message: "Gagal memuat hotspot.", onRetry: hotspots.retry });
  if (risk.error) status.push({ kind: "error", message: "Gagal memuat prediksi risiko.", onRetry: risk.retry });
  if (hotspots.loading || risk.loading) status.push({ kind: "loading", message: "Memuat peta…" });

  return (
    <div className="map-frame relative isolate h-[360px] overflow-hidden rounded-2xl border bg-muted sm:h-[460px]">
      <RegionMap
        slug={slug}
        name={name}
        bbox={bbox}
        hotspots={regionHotspots}
        risk={risk.data}
        boundaries={boundaries.data}
        regionNames={regionNames}
        onReady={setMap}
      />
      <p className="glass-panel absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
        <HotspotGlyph size={8} /> Hotspot 7 hari · risiko besok
      </p>
      <MapStatus items={status} className="absolute inset-x-0 top-14 z-[600] px-4" />
      <MapControls map={map} home={bbox} homeLabel={`Kembali ke ${name}`} className="absolute top-3 right-3 z-[500]" />
      <MapLegend layers={["risiko", "hotspot", "batas"]} defaultOpen={false} className="absolute bottom-12 left-3 z-[500] w-56 sm:bottom-3" />
    </div>
  );
}
