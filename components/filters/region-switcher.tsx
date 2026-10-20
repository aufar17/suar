"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { openCommandMenu } from "@/components/ui/command-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Region } from "@/types";

/** Jump to another region page: a select, plus a shortcut into the command palette. */
export function RegionSwitcher({ regions, current }: { regions: Region[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={current}
        onValueChange={(slug) => startTransition(() => router.push(`/wilayah/${slug}`))}
      >
        <SelectTrigger aria-label="Pindah ke kabupaten/kota lain" aria-busy={pending} className="w-full bg-card sm:w-56">
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin text-muted-foreground" />
          ) : (
            <MapPin aria-hidden="true" className="text-muted-foreground" />
          )}
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {regions.map((region) => (
            <SelectItem key={region.slug} value={region.slug}>
              {region.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Cari wilayah (Ctrl+K)" onClick={openCommandMenu} className="shrink-0">
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cari wilayah · Ctrl/⌘ K</TooltipContent>
      </Tooltip>
    </div>
  );
}
