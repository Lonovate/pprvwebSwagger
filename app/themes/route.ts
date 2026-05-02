/**
 * app/themes/route.ts
 * GET /themes  — JSON list of every theme that's exposed to VIVI.
 * Useful for debugging and for dynamically generating the VIVI agent's
 * system prompt.
 */

import { NextResponse } from "next/server";
import { THEMES, VIVI_THEME_KEYS } from "@/config/themes";

export const dynamic = "force-static";

export async function GET() {
  const themes = VIVI_THEME_KEYS.map((key) => ({
    key,
    title: THEMES[key].title,
    description: THEMES[key].description,
    sourceTags: THEMES[key].tags,
    allowedMethods: THEMES[key].allowedMethods,
    triggers: THEMES[key].triggers,
    schemaUrl: `/themes/${key}/openapi.json`,
  }));
  return NextResponse.json({ count: themes.length, themes });
}
