import Link from "next/link";
import { getDataStatus } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme";

export async function SiteHeader() {
  const status = await getDataStatus();
  return (
    <header className="sticky top-0 z-[1100] flex h-[var(--header-h)] flex-col border-b border-line bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-6">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2.5" aria-label="SiAPI, ke halaman peta">
          <LogoMark className="size-8 shrink-0" />
          <span className="min-w-0">
            <span className="block text-base leading-tight font-semibold text-fg">SiAPI</span>
            <span className="block truncate text-xs text-fg-muted">Pemantauan &amp; Prediksi Karhutla Riau</span>
          </span>
        </Link>
        <NavLinks variant="desktop" className="ml-6 hidden lg:block" />
        <div className="ml-auto flex items-center gap-3">
          <p className="hidden text-right text-xs leading-snug text-fg-muted md:block">
            Data terakhir diperbarui
            <br />
            <time dateTime={status.terakhir_diperbarui} className="font-mono text-fg">
              {formatDateTime(status.terakhir_diperbarui)}
            </time>
          </p>
          <ThemeToggle />
        </div>
      </div>
      <NavLinks variant="mobile" className="flex h-11 border-t border-line px-2 lg:hidden" />
    </header>
  );
}
