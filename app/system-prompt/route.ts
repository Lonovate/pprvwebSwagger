/**
 * app/system-prompt/route.ts
 * GET /system-prompt → text/plain. Always reflects current themes.
 */

import { generateSystemPrompt } from "@/lib/agent/system-prompt";
import { loadCatalog } from "@/lib/catalog/runtime";
import { deriveThemes } from "@/lib/themes/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const cat = await loadCatalog();
  const themes = deriveThemes(cat.swagger);
  const text = generateSystemPrompt(themes);
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
