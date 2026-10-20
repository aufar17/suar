"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_ITEMS } from "./nav-items";

function NavList({ pathname, className }: { pathname: string | null; className?: string }) {
  return (
    <nav aria-label="Navigasi utama" className={className}>
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(item.href, pathname);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
              {active ? (
                <motion.span
                  layoutId="nav-indicator"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-md bg-muted"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveNavList({ className }: { className?: string }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} className={className} />;
}

/**
 * Desktop navigation with an animated active indicator. The pathname is URL data, so it
 * is read inside Suspense; the fallback renders the same links without an active state.
 */
export function NavLinks({ className }: { className?: string }) {
  return (
    <Suspense fallback={<NavList pathname={null} className={className} />}>
      <ActiveNavList className={className} />
    </Suspense>
  );
}
