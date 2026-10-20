"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MonthlyTrend } from "@/types";
import { MonthlyTrendChart, YearComparisonChart } from "./lazy";

/** Main statistics card body: switch between the 24-month trend and the year comparison. */
export function TrendTabs({
  trend,
  currentYear,
  scopeName,
  periodLabel,
}: {
  trend: MonthlyTrend[];
  currentYear: number;
  scopeName: string;
  periodLabel: string;
}) {
  return (
    <Tabs defaultValue="tren" className="gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Hotspot per bulan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {scopeName} · {periodLabel}
          </p>
        </div>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="tren" className="px-3">
            Tren 24 bulan
          </TabsTrigger>
          <TabsTrigger value="tahun" className="px-3">
            Antar tahun
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="tren">
        <MonthlyTrendChart data={trend} />
      </TabsContent>
      <TabsContent value="tahun">
        <YearComparisonChart data={trend} currentYear={currentYear} />
      </TabsContent>
    </Tabs>
  );
}
