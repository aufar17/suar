"use client";

// Fallback when the root layout itself fails, so it cannot rely on the app's CSS, fonts, or header.
// Colors follow the design tokens and the OS color scheme.
const css = `
  :root { color-scheme: light dark; --bg:#fafafa; --fg:#09090b; --muted:#5c5c66; --btn:#18181b; --btn-fg:#fafafa; --ring:#e8590c; }
  @media (prefers-color-scheme: dark) { :root { --bg:#09090b; --fg:#fafafa; --muted:#a1a1aa; --btn:#fafafa; --btn-fg:#18181b; --ring:#f97a3c; } }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; background:var(--bg); color:var(--fg);
    font-family: ui-sans-serif, system-ui, sans-serif; }
  main { text-align:center; padding:16px; max-width:28rem; }
  h1 { font-size:24px; font-weight:600; letter-spacing:-0.01em; margin:0 0 8px; }
  p { color:var(--muted); margin:0 0 20px; line-height:1.5; }
  button { min-height:44px; padding:0 18px; border:0; border-radius:10px; background:var(--btn); color:var(--btn-fg);
    font:inherit; font-size:14px; font-weight:500; cursor:pointer; }
  button:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main>
          <h1>Suar tidak dapat dimuat</h1>
          <p>Terjadi kesalahan pada aplikasi. Silakan coba lagi beberapa saat lagi.</p>
          <button type="button" onClick={reset}>
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
