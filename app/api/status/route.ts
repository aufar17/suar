import { jsonResponse } from "@/lib/api";
import { getDataStatus } from "@/lib/data";

export async function GET() {
  return jsonResponse(await getDataStatus());
}
