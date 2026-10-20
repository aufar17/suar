"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useJson } from "@/lib/use-json";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RiskCellCollection } from "@/types";
import { HotspotGlyph } from "./legend-icons";
import { MapLegend } from "./map-legend";
import { MapSkeleton } from "./map-skeleton";
import { MapStatus, type MapStatusItem } from "./map-status";

const RegionMap = dynamic(() => import("./region-map"), { ssr: false, loading: () => <MapSkeleton /> });

/** Fetches region data from the API and renders the region map with its legend. */
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
    <div className="map-frame relative isolate h-80 overflow-hidden rounded-xl border border-border sm:h-[420px]">
      <RegionMap
        slug={slug}
        name={name}
        bbox={bbox}
        hotspots={regionHotspots}
        risk={risk.data}
        boundaries={boundaries.data}
        regionNames={regionNames}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[800] flex justify-center px-4">
        <MapStatus items={status} />
      </div>
      <MapLegend layers={["risiko", "hotspot", "batas"]} defaultOpen={false} className="absolute bottom-6 left-3 z-[800]" />
      <p className="absolute top-3 left-3 z-[800] flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs text-foreground">
        <HotspotGlyph size={8} /> Hotspot 7 hari · risiko besok
      </p>
    </div>
  );
}
