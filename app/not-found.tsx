import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <LogoMark className="size-12" />
      <p className="font-mono text-sm text-fg-muted">404</p>
      <h1 className="text-2xl font-semibold text-fg">Halaman tidak ditemukan</h1>
      <p className="text-fg-muted">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Kembali ke peta
        </Link>
        <Link
          href="/wilayah"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-surface-2"
        >
          Daftar wilayah
        </Link>
      </div>
    </main>
  );
}
