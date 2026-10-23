"use client";

import { Loader2, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Region } from "@/types";

const ALL = "semua";

/**
 * Two-step region filter stored in the `provinsi` and `kabupaten` search params: pick a
 * province first, then (optionally) one of its regencies or cities.
 */
export function RegionSelect({
  regions,
  provinsi,
  kabupaten,
  className,
}: {
  regions: Region[];
  provinsi: string | null;
  kabupaten: string | null;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const provinces = regions.filter((r) => r.level === "provinsi");
  const regencies = provinsi ? regions.filter((r) => r.provinsi === provinsi) : [];

  const navigate = (patch: { provinsi?: string | null; kabupaten?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const icon = pending ? (
    <Loader2 aria-hidden="true" className="animate-spin text-muted-foreground" />
  ) : (
    <MapPin aria-hidden="true" className="text-muted-foreground" />
  );

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <Select
        value={provinsi ?? ALL}
        onValueChange={(next) => navigate({ provinsi: next === ALL ? null : next, kabupaten: null })}
      >
        <SelectTrigger aria-label="Filter provinsi" aria-busy={pending} className="w-full bg-card sm:w-56">
          {icon}
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          <SelectItem value={ALL}>Semua provinsi (Indonesia)</SelectItem>
          <SelectSeparator />
          {provinces.map((region) => (
            <SelectItem key={region.slug} value={region.slug}>
              {region.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        // An empty value shows the placeholder until a province is picked.
        value={provinsi ? (kabupaten ?? ALL) : ""}
        disabled={!provinsi}
        onValueChange={(next) => navigate({ kabupaten: next === ALL ? null : next })}
      >
        <SelectTrigger
          aria-label="Filter kabupaten/kota"
          aria-busy={pending}
          title={provinsi ? undefined : "Pilih provinsi dulu"}
          className="w-full bg-card sm:w-56"
        >
          <SelectValue placeholder="Pilih provinsi dulu" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          <SelectItem value={ALL}>Semua kabupaten/kota</SelectItem>
          <SelectSeparator />
          {regencies.map((region) => (
            <SelectItem key={region.slug} value={region.slug}>
              {region.level === "kota" ? `Kota ${region.nama}` : region.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
