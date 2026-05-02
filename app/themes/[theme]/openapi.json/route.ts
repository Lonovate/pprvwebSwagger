/**
 * app/themes/[theme]/openapi.json/route.ts
 * GET /themes/{theme}/openapi.json  — the sliced OpenAPI 3.x schema VIVI
 * imports as a Custom API integration.
 */

import { NextResponse } from "next/server";
import { THEMES, type ThemeKey } from "@/config/themes";
import { loadCatalog } from "@/lib/catalog/load";
import { buildThemedSchema } from "@/lib/openapi/slice";

export const dynamic = "force-static";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ theme: string }> },
) {
  const { theme } = await params;

  if (!(theme in THEMES)) {
    return NextResponse.json(
      { error: "Unknown theme", availableThemes: Object.keys(THEMES) },
      { status: 404 },
    );
  }

  const catalog = loadCatalog();
  const schema = buildThemedSchema(theme as ThemeKey, catalog);

  return NextResponse.json(schema, {
    headers: {
      // VIVI's importer reads this URL repeatedly; let it cache.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

export function generateStaticParams() {
  return Object.keys(THEMES).map((theme) => ({ theme }));
}
