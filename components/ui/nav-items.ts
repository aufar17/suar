import { BarChart3, Info, Map as MapIcon, MapPinned, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/statistik" | "/wilayah" | "/tentang";
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Peta", description: "Hotspot, zona, dan prediksi risiko", icon: MapIcon },
  { href: "/statistik", label: "Statistik", description: "Tren bulanan dan peringkat", icon: BarChart3 },
  { href: "/wilayah", label: "Wilayah", description: "12 kabupaten/kota", icon: MapPinned },
  { href: "/tentang", label: "Tentang", description: "Metode dan sumber data", icon: Info },
];

export function isActivePath(href: string, pathname: string | null): boolean {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
