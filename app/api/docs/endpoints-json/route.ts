/**
 * GET /api/docs/endpoints-json
 * Generates an endpoints.json file from the current swagger source,
 * matching the structure the VIVI bot uses for endpoint lookup.
 */

import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog/runtime";
import { generateEndpointsJson } from "@/lib/docs/generate-docx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cat = await loadCatalog();
    const json = generateEndpointsJson(cat.swagger);
    const body = JSON.stringify(json, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="endpoints.json"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
