"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { openCommandMenu } from "@/components/ui/command-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface RegionOption {
  slug: string;
  nama: string;
  href: string;
}

/** Jump to a sibling region page: a select, plus a shortcut into the command palette. */
export function RegionSwitcher({ options, current, label }: { options: RegionOption[]; current: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={current}
        onValueChange={(slug) => {
          const option = options.find((o) => o.slug === slug);
          if (option) startTransition(() => router.push(option.href));
        }}
      >
        <SelectTrigger aria-label={label} aria-busy={pending} className="w-full bg-card sm:w-56">
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin text-muted-foreground" />
          ) : (
            <MapPin aria-hidden="true" className="text-muted-foreground" />
          )}
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {options.map((option) => (
            <SelectItem key={option.slug} value={option.slug}>
              {option.nama}
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
        <TooltipContent>Cari provinsi atau kabupaten/kota · Ctrl/⌘ K</TooltipContent>
      </Tooltip>
    </div>
  );
}
