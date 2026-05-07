/**
 * lib/catalog/resolve.ts
 * Helper to resolve which catalog to load based on a request's ?url= param.
 */

import { loadCatalog, loadCatalogFromUrl } from "./runtime";
import { getEnv } from "@/lib/env";
import type { CatalogResult } from "./runtime";

export async function resolveCatalog(request: Request): Promise<CatalogResult> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (url && url !== getEnv().SWAGGER_URL) {
    return loadCatalogFromUrl(url);
  }

  return loadCatalog();
}
