"use client";

// Fallback when the root layout itself fails, so it cannot rely on the app's CSS or header.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#F3F4F0",
          color: "#1C2321",
        }}
      >
        <main style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>SiAPI tidak dapat dimuat</h1>
          <p style={{ color: "#4F5752", marginBottom: 16 }}>Terjadi kesalahan pada aplikasi. Silakan coba lagi.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "#1F3B36",
              color: "#FFFFFF",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
