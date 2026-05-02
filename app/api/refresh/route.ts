/**
 * app/api/refresh/route.ts
 * POST /api/refresh — invalidates the swagger cache so the next themed-schema
 * request re-fetches the source. The dashboard page calls this when the
 * "Refresh" button is pressed.
 */

import { revalidateTag } from "next/cache";
import { SWAGGER_CACHE_TAG } from "@/lib/catalog/runtime";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // Next 16 requires a profile arg; "max" = fully invalidate immediately.
  revalidateTag(SWAGGER_CACHE_TAG, "max");
  return NextResponse.json({
    ok: true,
    invalidatedTag: SWAGGER_CACHE_TAG,
    refreshedAt: new Date().toISOString(),
    note: "Cache invalidated. The next request to /themes/* will re-fetch the source swagger.",
  });
}

// Allow GET for convenience (browser address bar / curl test)
export async function GET() {
  return POST();
}
