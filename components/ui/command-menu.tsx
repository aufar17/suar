"use client";

import { Laptop, Loader2, MapPin, MapPinned, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@/components/ui/command";
import { regionDisplayName, regionHref } from "@/lib/labels";
import { useJson } from "@/lib/use-json";
import type { RegionIndexItem } from "@/types";
import { NAV_ITEMS } from "./nav-items";

const OPEN_EVENT = "siapi:command-menu";

/** Opens the command palette from anywhere (e.g. a "search regions" button on a page). */
export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function subscribeNothing() {
  return () => {};
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere (and during server render). */
function useModifierKey(): string {
  return useSyncExternalStore(
    subscribeNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  // The region list (548 entries) is loaded on first open instead of being sent with every page.
  const [wanted, setWanted] = useState(false);
  if (open && !wanted) setWanted(true);
  const regions = useJson<RegionIndexItem[]>(wanted ? "/api/regions/list" : null);
  const router = useRouter();
  const { setTheme } = useTheme();
  const modifier = useModifierKey();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const { provinces, regencies, provinceNames } = useMemo(() => {
    const list = regions.data ?? [];
    const provinces = list.filter((r) => r.level === "provinsi");
    return {
      provinces,
      regencies: list.filter((r) => r.level !== "provinsi"),
      provinceNames: new Map(provinces.map((p) => [p.slug, p.nama])),
    };
  }, [regions.data]);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Cari halaman atau wilayah"
        aria-keyshortcuts="Control+K Meta+K"
        className="h-9 gap-2 rounded-lg px-2.5 text-muted-foreground hover:text-foreground max-lg:size-10 lg:w-56 lg:justify-start lg:border lg:bg-card lg:px-3 lg:shadow-xs dark:lg:bg-input/30"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">Cari wilayah…</span>
        <kbd className="pointer-events-none ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium lg:inline-flex">
          {modifier} K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-lg">
        <CommandInput placeholder="Cari provinsi, kabupaten, kota, atau halaman…" />
        {regions.error ? (
          <p role="alert" className="border-b px-4 py-3 text-sm text-muted-foreground">
            Gagal memuat daftar wilayah.{" "}
            <button type="button" onClick={regions.retry} className="font-medium text-foreground underline underline-offset-2">
              Coba lagi
            </button>
          </p>
        ) : null}
        <CommandList className="max-h-[min(420px,60dvh)]">
          <CommandEmpty>Tidak ada hasil.</CommandEmpty>
          <CommandGroup heading="Halaman">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`halaman ${item.label} ${item.description}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                <span>{item.label}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {regions.loading ? (
            <CommandLoading label="Memuat daftar wilayah">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Memuat daftar wilayah…
              </span>
            </CommandLoading>
          ) : null}
          <CommandGroup heading="Provinsi">
            {provinces.map((region) => (
              <CommandItem
                key={region.slug}
                value={`provinsi ${region.nama} ${region.slug}`}
                onSelect={() => run(() => router.push(regionHref(region)))}
              >
                <MapPinned />
                <span>{region.nama}</span>
                <span className="ml-auto text-xs text-muted-foreground">Provinsi</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Kabupaten/kota">
            {regencies.map((region) => (
              <CommandItem
                key={region.slug}
                value={`wilayah ${regionDisplayName(region)} ${region.slug} ${provinceNames.get(region.provinsi ?? "") ?? ""}`}
                onSelect={() => run(() => router.push(regionHref(region)))}
              >
                <MapPin />
                <span className="truncate">{region.level === "kota" ? `Kota ${region.nama}` : region.nama}</span>
                <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                  {provinceNames.get(region.provinsi ?? "") ?? ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tema">
            <CommandItem value="tema terang light" onSelect={() => run(() => setTheme("light"))}>
              <Sun /> Terang
            </CommandItem>
            <CommandItem value="tema gelap dark" onSelect={() => run(() => setTheme("dark"))}>
              <Moon /> Gelap
            </CommandItem>
            <CommandItem value="tema sistem system" onSelect={() => run(() => setTheme("system"))}>
              <Laptop /> Ikuti sistem
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
