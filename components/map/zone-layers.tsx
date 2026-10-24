"use client";

import { Layer, Source } from "react-map-gl/maplibre";
import { formatDecimal, formatInteger } from "@/lib/format";
import { CLUSTER_STATUS_LABELS } from "@/lib/labels";
import { CLUSTER_STATUSES, type ClusterCollection, type ClusterProps, type ClusterStatus } from "@/types";
import { slotId } from "./basemap";
import { HOVER } from "./expressions";
import { escapeHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";
import { ZONE_STYLES } from "./styles";

/** MapLibre dashes are in line widths, ZONE_STYLES (shared with the legend's SVG) in pixels. */
function dashes(status: ClusterStatus): number[] | undefined {
  const { dashArray, weight } = ZONE_STYLES[status];
  return dashArray?.split(" ").map((px) => Number(px) / weight);
}

/** Fire zones: faint fill and an outline whose line style shows the status. */
export function ZoneLayers({
  data,
  regionNames,
  highlight = null,
  onSelect,
}: {
  data: ClusterCollection;
  regionNames: Record<string, string>;
  /** Legend hover: emphasize zones of this status. */
  highlight?: ClusterStatus | null;
  onSelect: (id: string) => void;
}) {
  const { colors } = useMapStyle();

  useLayerInteraction("zona-isi", {
    hover: true,
    tooltip: (feature) => {
      const p = feature.properties as ClusterProps;
      return tooltipHtml(
        escapeHtml(`Zona kebakaran · ${CLUSTER_STATUS_LABELS[p.status]}`),
        [
          ["Hotspot", formatInteger(p.jumlah_hotspot)],
          ["Luas", `${formatDecimal(p.luas_km2, 1)} km²`],
          ["Wilayah", regionNames[p.kabupaten] ?? p.kabupaten],
        ],
        "Klik untuk detail",
      );
    },
    onClick: (feature) => onSelect(String(feature.properties.id)),
  });

  return (
    <Source id="zona" type="geojson" data={data} promoteId="id">
      <Layer
        id="zona-isi"
        type="fill"
        beforeId={slotId("zona")}
        paint={{
          "fill-color": colors.cluster,
          "fill-opacity": [
            "case",
            HOVER,
            0.22,
            highlight ? ["case", ["==", ["get", "status"], highlight], 0.24, 0.03] : 0.1,
          ],
        }}
      />
      {CLUSTER_STATUSES.map((status) => {
        const style = ZONE_STYLES[status];
        const dashArray = dashes(status);
        const dimmed = highlight !== null && highlight !== status;
        return (
          <Layer
            key={status}
            id={`zona-garis-${status}`}
            type="line"
            beforeId={slotId("zona")}
            filter={["==", ["get", "status"], status]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": colors.cluster,
              "line-width": ["case", HOVER, style.weight + 0.6, highlight === status ? style.weight + 1 : style.weight],
              "line-opacity": dimmed ? 0.25 : style.opacity,
              ...(dashArray ? { "line-dasharray": dashArray } : {}),
            }}
          />
        );
      })}
    </Source>
  );
}
