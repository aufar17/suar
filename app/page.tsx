import { Suspense } from "react";
import { MapDashboard } from "@/components/map/map-dashboard";
import { MapSkeleton } from "@/components/map/map-skeleton";
import { getDataStatus } from "@/lib/data";

export default async function HomePage() {
  const status = await getDataStatus();
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100dvh-var(--header-h))]">
          <MapSkeleton />
        </div>
      }
    >
      <MapDashboard status={status} />
    </Suspense>
  );
}
