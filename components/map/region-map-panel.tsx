"use client";

import type L from "leaflet";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/use-json";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RegionStat, RiskCellCollection } from "@/types";
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
  const [map, setMap] = useState<L.Map | null>(null);
  const area = kind === "provinsi" ? `provinsi=${slug}` : `kabupaten=${slug}`;
  const hotspots = useJson<HotspotCollection>(`/api/hotspots?start=${hotspotStart}&end=${hotspotEnd}&${area}`);
  const risk = useJson<RiskCellCollection>(kind === "kabupaten" ? `/api/risk?target_date=${targetDate}&${area}` : null);
  const boundaries = useJson<RegionBoundaryCollection>(`/api/regions?level=kabupaten&provinsi=${provinsi}`);
  const provinces = useJson<RegionBoundaryCollection>("/api/regions?level=provinsi");
  const stats = useJson<RegionStat[]>(
    kind === "provinsi" ? `/api/stats/regions?level=kabupaten&provinsi=${slug}&date=${targetDate}` : null,
  );

  const regionNames = useMemo(
    () =>
      Object.fromEntries(
        [...(provinces.data?.features ?? []), ...(boundaries.data?.features ?? [])].map((f) => [
          f.properties.slug,
          f.properties.nama,
        ]),
      ),
    [provinces.data, boundaries.data],
  );
  const statsBySlug = useMemo(() => stats.data && Object.fromEntries(stats.data.map((s) => [s.slug, s])), [stats.data]);

  const status: MapStatusItem[] = [];
  if (hotspots.error) status.push({ kind: "error", message: "Gagal memuat hotspot.", onRetry: hotspots.retry });
  if (risk.error) status.push({ kind: "error", message: "Gagal memuat prediksi risiko.", onRetry: risk.retry });
  if (stats.error) status.push({ kind: "error", message: "Gagal memuat skor wilayah.", onRetry: stats.retry });
  if (hotspots.loading || risk.loading || stats.loading) status.push({ kind: "loading", message: "Memuat peta…" });

  return (
    <div className="map-frame relative isolate h-[360px] overflow-hidden rounded-2xl border bg-muted sm:h-[460px]">
      <RegionMap
        slug={slug}
        name={name}
        kind={kind}
        bbox={bbox}
        hotspots={hotspots.data}
        risk={risk.data}
        boundaries={boundaries.data}
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
