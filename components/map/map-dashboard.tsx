"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BottomSheet } from "@/components/panels/bottom-sheet";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import type { DataStatus } from "@/types";
import { MapSkeleton } from "./map-skeleton";

const DashboardMap = dynamic(() => import("./dashboard-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapDashboard({ status }: { status: DataStatus }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <main className="flex h-[calc(100dvh-var(--header-h))] flex-col xl:gap-4 xl:p-4">
      <h1 className="sr-only">Peta pemantauan dan prediksi karhutla Riau</h1>

      <div className="hidden grid-cols-4 gap-4 xl:grid">
        <StatCard label="Hotspot" value="–" hint={`Data ${status.tanggal_data}`} />
        <StatCard label="Zona kebakaran aktif" value="–" />
        <StatCard label="Kabupaten paling rawan" value="–" />
        <StatCard label="Rata-rata hari tanpa hujan" value="–" />
      </div>

      <div className="relative min-h-0 flex-1 xl:grid xl:grid-cols-[288px_minmax(0,1fr)_352px] xl:gap-4">
        <aside aria-label="Filter dan lapisan" className="hidden min-h-0 overflow-y-auto xl:block">
          <Card className="p-4">
            <CardHeader title="Filter" />
          </Card>
        </aside>

        <div className="map-frame relative isolate h-full overflow-hidden xl:rounded-card xl:border xl:border-line">
          <DashboardMap label="Peta hotspot dan risiko karhutla Provinsi Riau" />
        </div>

        <aside aria-label="Detail" className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
          <Card className="p-4">
            <CardHeader title="Detail" description="Klik kotak grid di peta untuk melihat detail risiko." />
          </Card>
        </aside>

        <BottomSheet className="xl:hidden" open={sheetOpen} onOpenChange={setSheetOpen} title="Ringkasan">
          <p className="text-sm text-fg-muted">Ringkasan dan detail akan tampil di sini.</p>
        </BottomSheet>
      </div>
    </main>
  );
}
