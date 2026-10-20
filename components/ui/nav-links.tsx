"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Peta" },
  { href: "/statistik", label: "Statistik" },
  { href: "/wilayah", label: "Wilayah" },
  { href: "/tentang", label: "Tentang" },
] as const;

export function NavLinks({ className, variant }: { className?: string; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  return (
    <nav aria-label={variant === "desktop" ? "Navigasi utama" : "Navigasi utama (seluler)"} className={className}>
      <ul className={clsx("flex", variant === "desktop" ? "gap-1" : "w-full")}>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className={clsx(variant === "mobile" && "flex-1")}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-11 items-center justify-center text-sm font-medium transition-colors",
                  variant === "desktop" && "rounded-lg px-3.5",
                  variant === "desktop" &&
                    (active ? "bg-primary text-primary-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"),
                  variant === "mobile" &&
                    (active
                      ? "border-b-2 border-primary text-fg"
                      : "border-b-2 border-transparent text-fg-muted hover:text-fg"),
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
