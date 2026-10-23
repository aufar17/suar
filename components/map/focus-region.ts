/** Custom event asking the dashboard map to zoom to a region (detail = slug). */
export const FOCUS_REGION_EVENT = "siapi:focus-region";

/** Zooms the dashboard map (if mounted) to a province or regency. */
export function focusRegionOnMap(slug: string) {
  window.dispatchEvent(new CustomEvent<string>(FOCUS_REGION_EVENT, { detail: slug }));
}
