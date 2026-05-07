/**
 * GET /api/docs/download?url=...
 * Generates an endpoints.docx file from the swagger source.
 */

import { NextResponse } from "next/server";
import { resolveCatalog } from "@/lib/catalog/resolve";
import { generateEndpointsDocx } from "@/lib/docs/generate-docx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cat = await resolveCatalog(request);
    const buffer = await generateEndpointsDocx(cat.swagger, cat.baseUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="endpoints.md.docx"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
