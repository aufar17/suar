"use client";

import { MapView } from "./map-view";

export interface DashboardMapProps {
  label: string;
}

/** Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx). */
export default function DashboardMap({ label }: DashboardMapProps) {
  return <MapView label={label} />;
}
