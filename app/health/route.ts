/**
 * app/health/route.ts
 * Liveness probe. Returns { ok: true } so health checks don't churn.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ ok: true });
}
