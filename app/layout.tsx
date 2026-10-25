import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/ui/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Suar",
  title: {
    default: "Suar – Pemantauan & Prediksi Karhutla Indonesia",
    template: "%s · Suar",
  },
  description:
    "Dashboard pemantauan hotspot dan prediksi risiko kebakaran hutan dan lahan di seluruh Indonesia, per provinsi dan kabupaten/kota.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Suar",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#konten"
            className="sr-only z-[2000] rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Lewati ke konten
          </a>
          <SiteHeader />
          <div id="konten" className="flex flex-1 flex-col">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
