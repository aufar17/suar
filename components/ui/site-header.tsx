import Link from "next/link";
import { getDataStatus } from "@/lib/data";
import { CommandMenu } from "./command-menu";
import { DataStatusBadge } from "./data-status-badge";
import { LogoMark } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme";

export async function SiteHeader() {
  const status = await getDataStatus();
  return (
    <header className="sticky top-0 z-40 h-(--header-h) border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-full items-center gap-2 px-3 sm:px-4 lg:px-6">
        <Link
          href="/"
          className="-ml-1 flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-1"
          aria-label="SiAPI, ke halaman peta"
        >
          <LogoMark className="size-7" />
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">SiAPI</span>
            <span className="hidden text-xs text-muted-foreground xl:inline">Karhutla Riau</span>
          </span>
        </Link>

        <span aria-hidden="true" className="mx-2 hidden h-5 w-px bg-border md:block" />
        <NavLinks className="hidden md:block" />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <DataStatusBadge status={status} className="hidden md:inline-flex" />
          <CommandMenu />
          <ThemeToggle />
          <MobileNav footer={<DataStatusBadge status={status} detailed />} />
        </div>
      </div>
    </header>
  );
}
