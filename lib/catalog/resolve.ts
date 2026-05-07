/**
 * lib/catalog/resolve.ts
 * Resolves which catalog to use based on request params:
 *   ?sid=  → from session cache (parsed Postman/GraphQL/HAR/cURL)
 *   ?url=  → from a specific swagger URL
 *   (none) → from the default cached swagger
 */

import { loadCatalog, loadCatalogFromUrl } from "./runtime";
import { getCachedSource } from "./session-cache";
import { getEnv } from "@/lib/env";
import type { CatalogResult } from "./runtime";

export async function resolveCatalog(request: Request): Promise<CatalogResult> {
  const { searchParams } = new URL(request.url);

  // 1. Session cache (parsed non-swagger sources)
  const sid = searchParams.get("sid");
  if (sid) {
    const cached = getCachedSource(sid);
    if (!cached) throw new Error("Session expired. Please refresh from source again.");
    return {
      swagger: cached.swagger,
      lastFetched: cached.lastFetched,
      swaggerUrl: `session:${cached.sourceFormat}`,
      baseUrl: cached.baseUrl,
    };
  }

  // 2. Explicit swagger URL
  const url = searchParams.get("url");
  if (url && url !== getEnv().SWAGGER_URL) {
    return loadCatalogFromUrl(url);
  }

  // 3. Default cached swagger
  return loadCatalog();
}
