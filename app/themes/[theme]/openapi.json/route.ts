/**
 * app/themes/[theme]/openapi.json/route.ts
 * GET /themes/{theme}/openapi.json — the sliced OpenAPI 3.x schema VIVI
 * imports as a Custom API integration. Themes are derived dynamically.
 */

import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog/runtime";
import { deriveThemes } from "@/lib/themes/registry";
import { buildThemedSchema } from "@/lib/openapi/slice";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ theme: string }> },
) {
  const { theme } = await params;

  const cat = await loadCatalog();
  const themes = deriveThemes(cat.swagger);

  if (!(theme in themes)) {
    return NextResponse.json(
      {
        error: "Unknown theme",
        availableThemes: Object.keys(themes).filter((k) => themes[k].exposeToVivi),
      },
      { status: 404 },
    );
  }

  const schema = buildThemedSchema(theme, cat.swagger, themes);
  return NextResponse.json(schema, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
