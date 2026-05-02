/**
 * app/system-prompt/route.ts
 * GET /system-prompt → text/plain. Always reflects the current config/themes.ts.
 * Useful for previewing in browser, scripted fetches, or pasting into VIVI.
 */

import { generateSystemPrompt } from "@/lib/agent/system-prompt";

export const dynamic = "force-static";

export async function GET() {
  const text = generateSystemPrompt();
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
