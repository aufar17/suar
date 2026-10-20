/** Small glyphs that mirror how each layer is drawn on the map. */

export function HotspotGlyph({ size = 12, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size + 2} height={size + 2} viewBox={`0 0 ${size + 2} ${size + 2}`} aria-hidden="true">
      <circle
        cx={(size + 2) / 2}
        cy={(size + 2) / 2}
        r={size / 2}
        fill="var(--map-hotspot)"
        fillOpacity={opacity}
        stroke="var(--map-hotspot-stroke)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function ZoneGlyph() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      <path
        d="M2 4 7 1.5 14 4 13 11 5 12.5 2 9Z"
        fill="var(--map-cluster)"
        fillOpacity="0.12"
        stroke="var(--map-cluster)"
        strokeWidth="1.4"
        strokeDasharray="2.5 2"
      />
    </svg>
  );
}

export function RiskGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="7" height="7" fill="var(--risk-sedang)" />
      <rect x="8" y="1" width="7" height="7" fill="var(--risk-tinggi)" />
      <rect x="1" y="8" width="7" height="7" fill="var(--risk-tinggi)" />
      <rect x="8" y="8" width="7" height="7" fill="var(--risk-sangat-tinggi)" />
    </svg>
  );
}

export function BoundaryGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 13 4 3 11 2 14 9 8 14Z" fill="none" stroke="var(--map-boundary)" strokeWidth="1.6" />
    </svg>
  );
}

export function PeatGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="var(--map-gambut)" fillOpacity="0.45" />
    </svg>
  );
}
