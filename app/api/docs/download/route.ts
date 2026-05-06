/**
 * GET /api/docs/download
 * Generates an endpoints.docx file from the current swagger source,
 * matching the structure of the original endpoints.md.docx document.
 */

import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog/runtime";
import { generateEndpointsDocx } from "@/lib/docs/generate-docx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cat = await loadCatalog();
    const buffer = await generateEndpointsDocx(cat.swagger);

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
