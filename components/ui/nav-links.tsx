"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Peta" },
  { href: "/statistik", label: "Statistik" },
  { href: "/wilayah", label: "Wilayah" },
  { href: "/tentang", label: "Tentang" },
] as const;

interface NavLinksProps {
  className?: string;
  variant: "desktop" | "mobile";
}

function NavList({ className, variant, pathname }: NavLinksProps & { pathname: string | null }) {
  return (
    <nav aria-label={variant === "desktop" ? "Navigasi utama" : "Navigasi utama (seluler)"} className={className}>
      <ul className={clsx("flex", variant === "desktop" ? "gap-1" : "w-full")}>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname !== null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
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

function ActiveNavList(props: NavLinksProps) {
  const pathname = usePathname();
  return <NavList {...props} pathname={pathname} />;
}

/**
 * The pathname is URL data, so it is read inside Suspense; the fallback renders the
 * same links without an active state and keeps the layout prerendered.
 */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNavList {...props} />
    </Suspense>
  );
}
