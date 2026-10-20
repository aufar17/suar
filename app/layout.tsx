import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/ui/site-header";
import { themeScript } from "@/components/ui/theme-script";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SiAPI – Pemantauan & Prediksi Karhutla Riau",
  description:
    "Dashboard pemantauan hotspot dan prediksi risiko kebakaran hutan dan lahan di Provinsi Riau.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-theme="light"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#konten"
          className="sr-only z-[2000] rounded-lg bg-primary px-4 py-3 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Lewati ke konten
        </a>
        <SiteHeader />
        <div id="konten" className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
