import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { RegionOverview, RegionSkeleton } from "@/components/panels/region-overview";
import { getRegionDetail, getRegions } from "@/lib/data";
import { regionDisplayName, regionHref } from "@/lib/labels";

// See ../page.tsx: slugs are checked before Suspense to return a real 404.
export const instant = false;

export async function generateStaticParams() {
  const regions = await getRegions();
  return regions
    .filter((r) => r.level !== "provinsi" && r.provinsi)
    .map((r) => ({ provinsi: r.provinsi!, kabupaten: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/wilayah/[provinsi]/[kabupaten]">): Promise<Metadata> {
  const { kabupaten } = await params;
  const region = await getRegionDetail(kabupaten);
  if (!region || region.level === "provinsi") return { title: "Wilayah tidak ditemukan" };
  const name = regionDisplayName(region);
  return {
    title: name,
    description: `Hotspot terbaru, cuaca, prediksi risiko kebakaran 7 hari, dan tren bulanan untuk ${name}, ${region.nama_provinsi ?? ""}.`,
  };
}

export default async function KabupatenPage({ params }: PageProps<"/wilayah/[provinsi]/[kabupaten]">) {
  const { provinsi, kabupaten } = await params;
  const region = (await getRegions()).find((r) => r.slug === kabupaten);
  if (!region || region.level === "provinsi") notFound();
  // A regency under the wrong province: send it to its canonical address.
  if (region.provinsi !== provinsi) permanentRedirect(regionHref(region));
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:py-6 lg:px-8 lg:py-8">
      <Suspense fallback={<RegionSkeleton />}>
        <RegionOverview slug={kabupaten} />
      </Suspense>
    </main>
  );
}
