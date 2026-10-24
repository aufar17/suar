import { jsonResponse, notFound } from "@/lib/api";
import { getHotspot } from "@/lib/data";

/** One hotspot with every property (detail panel). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotspot = /^[A-Za-z0-9_-]+$/.test(id) ? await getHotspot(id) : null;
  if (!hotspot) return notFound(`Hotspot "${id}" tidak ditemukan`);
  return jsonResponse(hotspot);
}
