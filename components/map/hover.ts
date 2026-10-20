import L from "leaflet";

/**
 * One shared tooltip for a whole feature group (cheaper than binding thousands).
 * `content` returns the HTML for the hovered child; `onHover` lets the layer
 * highlight it. Touch taps fire `mouseover` too, so the tooltip closes on click.
 */
export function attachHoverTooltip<T extends L.Layer>(
  map: L.Map,
  group: L.FeatureGroup,
  content: (layer: T) => string,
  onHover?: (layer: T | null) => void,
) {
  const tooltip = L.tooltip({ className: "map-tooltip", direction: "top", offset: [0, -10], opacity: 1 });
  let current: T | null = null;

  const open = (event: L.LeafletMouseEvent) => {
    const layer = event.propagatedFrom as T | undefined;
    if (!layer) return;
    if (layer !== current) {
      current = layer;
      onHover?.(layer);
      tooltip.setContent(content(layer));
    }
    tooltip.setLatLng(event.latlng);
    if (!map.hasLayer(tooltip)) tooltip.addTo(map);
  };
  const close = () => {
    if (current) onHover?.(null);
    current = null;
    tooltip.remove();
  };

  group.on("mouseover", open);
  group.on("mousemove", (event: L.LeafletMouseEvent) => tooltip.setLatLng(event.latlng));
  group.on("mouseout", close);
  group.on("click", () => tooltip.remove());
  return close;
}

/** Tooltip body: bold title, optional detail rows, and a hint line. */
export function tooltipHtml(title: string, rows: [string, string][] = [], hint?: string): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--muted-foreground)">${escapeHtml(label)}</span><span style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${escapeHtml(value)}</span></div>`,
    )
    .join("");
  const footer = hint ? `<div style="margin-top:4px;color:var(--muted-foreground);font-size:11px">${escapeHtml(hint)}</div>` : "";
  return `<div style="font-weight:600;margin-bottom:${rows.length ? 4 : 0}px">${title}</div>${body}${footer}`;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for Leaflet tooltip HTML strings. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Small colored chip used inside tooltip titles (always paired with a text label). */
export function swatchHtml(color: string, outlined = false): string {
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;vertical-align:0;background:${color};${outlined ? "border:1px solid var(--muted-foreground)" : ""}"></span>`;
}
