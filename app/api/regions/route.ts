import { jsonResponse } from "@/lib/api";
import { getRegionBoundaries } from "@/lib/data";

export async function GET() {
  return jsonResponse(await getRegionBoundaries());
}
