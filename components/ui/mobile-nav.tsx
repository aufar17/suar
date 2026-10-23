"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { isActivePath, NAV_ITEMS } from "./nav-items";

function MobileNavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  return (
    <nav aria-label="Navigasi utama">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-5 shrink-0", active && "text-ember-ink")} aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveMobileNavLinks({ onNavigate }: { onNavigate: () => void }) {
  return <MobileNavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

/** Below `md` the navigation moves into a sheet opened from the header. */
export function MobileNav({ footer }: { footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Buka menu navigasi" className="md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)] gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <LogoMark className="size-7" /> SiAPI
          </SheetTitle>
          <SheetDescription className="text-xs">Pemantauan &amp; prediksi karhutla Indonesia</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
          <Suspense fallback={<MobileNavLinks pathname={null} onNavigate={close} />}>
            <ActiveMobileNavLinks onNavigate={close} />
          </Suspense>
        </div>
        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
