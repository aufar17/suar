import { jsonResponse } from "@/lib/api";
import { getProvinceLines } from "@/lib/data";

/** Province borders that line up with the regency outlines (drawn at closer zoom levels). */
export async function GET() {
  return jsonResponse(await getProvinceLines());
}
