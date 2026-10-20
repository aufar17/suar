"use client";

import { Loader2, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Region } from "@/types";

const ALL = "semua";

/** Region filter stored in the `kabupaten` search param. */
export function RegionSelect({ regions, value, className }: { regions: Region[]; value: string | null; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next !== ALL) params.set("kabupaten", next);
        else params.delete("kabupaten");
        const query = params.toString();
        startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
      }}
    >
      <SelectTrigger
        aria-label="Filter kabupaten/kota"
        aria-busy={pending}
        className={cn("w-full bg-card sm:w-60", className)}
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin text-muted-foreground" />
        ) : (
          <MapPin aria-hidden="true" className="text-muted-foreground" />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80">
        <SelectItem value={ALL}>Semua (Provinsi Riau)</SelectItem>
        <SelectSeparator />
        {regions.map((region) => (
          <SelectItem key={region.slug} value={region.slug}>
            {region.nama}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
