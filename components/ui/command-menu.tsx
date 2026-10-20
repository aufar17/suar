"use client";

import { Laptop, MapPin, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { regionDisplayName } from "@/lib/labels";
import type { Region } from "@/types";
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

export function CommandMenu({ regions }: { regions: Region[] }) {
  const [open, setOpen] = useState(false);
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

  const kabupaten = regions.filter((r) => r.level !== "provinsi");

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
        <CommandInput placeholder="Cari kabupaten, kota, atau halaman…" />
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
          <CommandGroup heading="Kabupaten/kota">
            {kabupaten.map((region) => (
              <CommandItem
                key={region.slug}
                value={`wilayah ${regionDisplayName(region)} ${region.slug}`}
                onSelect={() => run(() => router.push(`/wilayah/${region.slug}`))}
              >
                <MapPin />
                <span>{region.nama}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {region.level === "kota" ? "Kota" : "Kabupaten"}
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
