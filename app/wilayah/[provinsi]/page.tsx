import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { RegionOverview, RegionSkeleton } from "@/components/panels/region-overview";
import { getRegionDetail, getRegions } from "@/lib/data";
import { regionDisplayName, regionHref } from "@/lib/labels";

// Every province is prerendered by generateStaticParams. The slug is checked before the
// Suspense boundary so unknown slugs get a real HTTP 404 instead of a streamed soft 404,
// which means this segment cannot also pass the instant-navigation validation.
export const instant = false;

export async function generateStaticParams() {
  const regions = await getRegions();
  return regions.filter((r) => r.level === "provinsi").map((r) => ({ provinsi: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/wilayah/[provinsi]">): Promise<Metadata> {
  const { provinsi } = await params;
  const region = await getRegionDetail(provinsi);
  if (!region || region.level !== "provinsi") return { title: "Wilayah tidak ditemukan" };
  const name = regionDisplayName(region);
  return {
    title: name,
    description: `Hotspot terbaru, cuaca, prediksi risiko kebakaran 7 hari, tren bulanan, dan peringkat ${region.jumlah_kabupaten} kabupaten/kota di ${name}.`,
  };
}

export default async function ProvinsiPage({ params }: PageProps<"/wilayah/[provinsi]">) {
  const { provinsi } = await params;
  const region = (await getRegions()).find((r) => r.slug === provinsi);
  if (!region) notFound();
  // Links from before the national scope pointed at /wilayah/<kabupaten>.
  if (region.level !== "provinsi") permanentRedirect(regionHref(region));
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:py-6 lg:px-8 lg:py-8">
      <Suspense fallback={<RegionSkeleton />}>
        <RegionOverview slug={provinsi} />
      </Suspense>
    </main>
  );
}
