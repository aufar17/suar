import { Map as MapIcon, MapPinned } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <p className="font-mono text-7xl font-semibold tracking-tighter text-muted-foreground">404</p>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-muted-foreground">
          Alamat yang Anda buka tidak ada atau sudah dipindahkan. Coba cari wilayah lewat tombol cari di atas.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <MapIcon /> Kembali ke peta
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/wilayah">
            <MapPinned /> Daftar wilayah
          </Link>
        </Button>
      </div>
    </main>
  );
}
