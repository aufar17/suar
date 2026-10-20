"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon } from "@/components/ui/icons";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <AlertIcon className="size-10 text-accent" />
      <h1 className="text-2xl font-semibold text-fg">Terjadi kesalahan</h1>
      <p className="text-fg-muted">
        Data tidak dapat dimuat saat ini. Coba lagi beberapa saat lagi.
        {error.digest ? <span className="mt-1 block font-mono text-xs">Kode: {error.digest}</span> : null}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-surface-2"
        >
          Kembali ke peta
        </Link>
      </div>
    </main>
  );
}
