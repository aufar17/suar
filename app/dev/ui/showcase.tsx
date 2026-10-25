"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Flame, Layers, Map as MapIcon, Minus, Plus, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CountUp } from "@/components/ui/count-up";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NoPredictionBadge, NoPredictionSwatch, RiskBadge, RiskSwatch } from "@/components/ui/risk-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInteger } from "@/lib/format";
import { RISK_LEVEL_ORDER } from "@/lib/risk";

const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "ring",
  "destructive",
  "ember",
  "ember-ink",
  "ember-soft",
];

const MAP_TOKENS = ["map-hotspot", "map-cluster", "map-boundary", "map-gambut", "map-unpredicted", "map-selection"];
const CHART_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

const DEMO_CHART = [
  { bulan: "Jun", hotspot: 120 },
  { bulan: "Jul", hotspot: 340 },
  { bulan: "Agu", hotspot: 610 },
  { bulan: "Sep", hotspot: 820 },
  { bulan: "Okt", hotspot: 540 },
];

const chartConfig = { hotspot: { label: "Hotspot", color: "var(--chart-1)" } } satisfies ChartConfig;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-lg border" style={{ background: `var(--${token})` }} />
      <code className="font-mono text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

export function UiShowcase() {
  const [count, setCount] = useState(1284);
  const [day, setDay] = useState([3]);
  const [range, setRange] = useState("1");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">/dev/ui · internal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Design system Suar</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Token warna, tipografi, dan komponen dasar. Halaman ini tidak tampil di navigasi.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Warna dasar">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <Swatch key={token} token={token} />
          ))}
        </div>
      </Section>

      <Section title="Skala risiko">
        <div className="flex flex-wrap items-center gap-6">
          {RISK_LEVEL_ORDER.map((level) => (
            <div key={level} className="flex items-center gap-2">
              <RiskSwatch level={level} />
              <RiskBadge level={level} />
              <RiskBadge level={level} size="sm" />
              <RiskBadge level={level} size="lg" />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <NoPredictionSwatch />
            <NoPredictionBadge />
            <NoPredictionBadge size="sm" />
            <NoPredictionBadge size="lg" />
          </div>
        </div>
      </Section>

      <Section title="Peta & grafik">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[...MAP_TOKENS, ...CHART_TOKENS].map((token) => (
            <Swatch key={token} token={token} />
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <div className="flex flex-col gap-3">
          <p className="text-4xl font-semibold tracking-tight">Prediksi risiko 7 hari</p>
          <p className="text-2xl font-semibold tracking-tight">Statistik hotspot</p>
          <p className="text-base">Teks isi memakai Geist Sans 16 px dengan tinggi baris lega.</p>
          <p className="text-sm text-muted-foreground">Teks pendukung 14 px, warna muted.</p>
          <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">0,82 · 1.284 · R-104-37</p>
        </div>
      </Section>

      <Section title="Tombol">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Utama</Button>
          <Button variant="ember">
            <Flame /> Aksen
          </Button>
          <Button variant="secondary">Sekunder</Button>
          <Button variant="outline">Garis</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Tautan</Button>
          <Button variant="destructive">Hapus</Button>
          <Button size="sm">Kecil</Button>
          <Button size="lg">Besar</Button>
          <Button size="icon" variant="outline" aria-label="Perbesar">
            <Plus />
          </Button>
          <Button size="icon" variant="outline" aria-label="Perkecil">
            <Minus />
          </Button>
          <Button disabled>Nonaktif</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Sekunder</Badge>
          <Badge variant="outline">Data contoh</Badge>
          <Badge variant="destructive">Error</Badge>
        </div>
      </Section>

      <Section title="Kartu & angka">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Hotspot 24 jam</CardDescription>
              <CardTitle className="font-mono text-3xl tabular-nums">
                <CountUp value={count} format={formatInteger} />
              </CardTitle>
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => setCount((c) => c + Math.round(Math.random() * 400))}>
                  Ubah
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Klik “Ubah” untuk melihat count-up.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Memuat</CardTitle>
              <CardDescription>Skeleton mengikuti bentuk konten</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Panel kaca</CardTitle>
              <CardDescription>Latar hampir pekat tanpa blur untuk panel di atas peta</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section title="Kontrol">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <ToggleGroup
              type="single"
              variant="outline"
              value={range}
              onValueChange={(v) => v && setRange(v)}
              aria-label="Rentang waktu"
            >
              <ToggleGroupItem value="1">24 jam</ToggleGroupItem>
              <ToggleGroupItem value="3">3 hari</ToggleGroupItem>
              <ToggleGroupItem value="7">7 hari</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                Prediksi hari <span className="font-mono">+{day[0]}</span>
              </p>
              <Slider min={1} max={7} step={1} value={day} onValueChange={setDay} aria-label="Hari prediksi" />
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" /> Lapisan risiko
              </span>
              <Switch defaultChecked />
            </label>
            <Select defaultValue="siak">
              <SelectTrigger className="w-full sm:w-64" aria-label="Kabupaten">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="siak">Siak</SelectItem>
                <SelectItem value="pelalawan">Pelalawan</SelectItem>
                <SelectItem value="bengkalis">Bengkalis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Tabs defaultValue="tren">
            <TabsList>
              <TabsTrigger value="tren">Tren</TabsTrigger>
              <TabsTrigger value="tahun">Antar tahun</TabsTrigger>
            </TabsList>
            <TabsContent value="tren">
              <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
                <BarChart data={DEMO_CHART} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bulan" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="hotspot" fill="var(--color-hotspot)" radius={6} />
                </BarChart>
              </ChartContainer>
            </TabsContent>
            <TabsContent value="tahun" className="text-sm text-muted-foreground">
              Konten tab kedua.
            </TabsContent>
          </Tabs>
        </div>
      </Section>

      <Section title="Overlay">
        <div className="flex flex-wrap gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Skor 0,82 · Sangat tinggi</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings2 /> Popover
              </Button>
            </PopoverTrigger>
            <PopoverContent className="text-sm">Isi popover singkat.</PopoverContent>
          </Popover>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Detail kotak grid</SheetTitle>
                <SheetDescription>Panel detail dari kanan (desktop).</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Detail kotak grid</DrawerTitle>
                <DrawerDescription>Panel detail dari bawah (mobile).</DrawerDescription>
              </DrawerHeader>
              <div className="h-24" />
            </DrawerContent>
          </Drawer>
          <Button variant="outline" onClick={() => toast.success("CSV berhasil diunduh", { description: "suar-hotspot.csv" })}>
            Toast
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Command className="rounded-xl border">
            <CommandInput placeholder="Cari kabupaten…" />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              <CommandGroup heading="Wilayah">
                {["Siak", "Pelalawan", "Bengkalis", "Indragiri Hilir"].map((name) => (
                  <CommandItem key={name}>
                    <MapIcon /> {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <ScrollArea className="h-48 rounded-xl border p-4">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i}>
                <p className="py-2 text-sm">Baris {i + 1}</p>
                <Separator />
              </div>
            ))}
          </ScrollArea>
        </div>
      </Section>
    </main>
  );
}
