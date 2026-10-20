"use client";

import { Map as MapIcon, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16">
      <h1 className="sr-only">Terjadi kesalahan</h1>
      <ErrorState
        title="Halaman ini gagal dimuat"
        description="Data tidak dapat diambil saat ini. Coba lagi beberapa saat lagi, atau kembali ke peta."
        detail={error.digest ? `Kode: ${error.digest}` : undefined}
        retry={
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <RotateCw /> Coba lagi
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <MapIcon /> Kembali ke peta
              </Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
