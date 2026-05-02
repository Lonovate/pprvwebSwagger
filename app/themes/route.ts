/**
 * app/themes/route.ts
 * GET /themes — JSON list of every theme exposed to VIVI, derived at runtime.
 */

import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog/runtime";
import { deriveThemes, visibleThemes } from "@/lib/themes/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const cat = await loadCatalog();
  const themes = deriveThemes(cat.swagger);
  const list = visibleThemes(themes).map((t) => ({
    key: t.key,
    title: t.title,
    description: t.description,
    sourceTags: t.tags,
    allowedMethods: t.allowedMethods,
    operationCount: t.operationCount,
    triggers: t.triggers,
    schemaUrl: `/themes/${t.key}/openapi.json`,
  }));
  return NextResponse.json({
    count: list.length,
    lastFetched: cat.lastFetched,
    themes: list,
  });
}
