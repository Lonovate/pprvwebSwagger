/**
 * app/system-prompt/route.ts
 * GET /system-prompt?url=... → text/plain
 * Returns the concierge agent prompt (Layer 1).
 */

import { generateConciergePrompt } from "@/lib/agent/concierge-prompt";
import { resolveCatalog } from "@/lib/catalog/resolve";
import { deriveThemes } from "@/lib/themes/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cat = await resolveCatalog(request);
  const themes = deriveThemes(cat.swagger);
  const text = generateConciergePrompt(themes);
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
