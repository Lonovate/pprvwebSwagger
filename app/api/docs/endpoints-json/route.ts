/**
 * GET /api/docs/endpoints-json?url=...
 * Generates an endpoints.json file from the swagger source.
 */

import { NextResponse } from "next/server";
import { resolveCatalog } from "@/lib/catalog/resolve";
import { generateEndpointsJson } from "@/lib/docs/generate-docx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cat = await resolveCatalog(request);
    const json = generateEndpointsJson(cat.swagger, cat.baseUrl);
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
