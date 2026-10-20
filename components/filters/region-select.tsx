"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import type { Region } from "@/types";

/** Region filter stored in the `kabupaten` search param. */
export function RegionSelect({ regions, value }: { regions: Region[]; value: string | null }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        Kabupaten/kota
      </label>
      <select
        id={id}
        value={value ?? ""}
        aria-busy={pending}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value) params.set("kabupaten", event.target.value);
          else params.delete("kabupaten");
          const query = params.toString();
          startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
        }}
        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg sm:w-64"
      >
        <option value="">Semua (Provinsi Riau)</option>
        {regions.map((region) => (
          <option key={region.slug} value={region.slug}>
            {region.nama}
          </option>
        ))}
      </select>
    </div>
  );
}
