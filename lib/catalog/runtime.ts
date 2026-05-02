/**
 * lib/catalog/runtime.ts
 * --------------------------------------------------------------------------
 * Runtime swagger fetcher. Fetches the source swagger on first request and
 * caches it via Next.js Data Cache. The "Refresh" button POSTs to /api/refresh
 * which calls revalidateTag(SWAGGER_CACHE_TAG) to invalidate this cache.
 *
 * NO build-time bake-in — adding a tag to the source API and pressing the
 * refresh button is enough; no redeploy needed.
 * --------------------------------------------------------------------------
 */

import { unstable_cache } from "next/cache";
import type { SourceSwagger } from "./types";

export const SWAGGER_CACHE_TAG = "swagger-source";
export const DEFAULT_SWAGGER_URL = "https://pprvmw.com/swagger/v1/swagger.json";

export interface CatalogResult {
  swagger: SourceSwagger;
  /** ISO timestamp of when this catalog was fetched from the source. */
  lastFetched: string;
  /** The URL that was fetched. */
  swaggerUrl: string;
}

function getSwaggerUrl(): string {
  return process.env.SWAGGER_URL || DEFAULT_SWAGGER_URL;
}

/**
 * Cached swagger fetch. The cache survives across requests in the same
 * Vercel environment until revalidateTag(SWAGGER_CACHE_TAG) invalidates it.
 *
 * `revalidate: 86400` is a passive backstop — if no manual refresh happens
 * for 24h, the next request triggers a re-fetch.
 */
const fetchSwaggerCached = unstable_cache(
  async (): Promise<CatalogResult> => {
    const url = getSwaggerUrl();
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      throw new Error(`[catalog] HTTP ${r.status} fetching ${url}`);
    }
    const swagger = (await r.json()) as SourceSwagger;
    return {
      swagger,
      lastFetched: new Date().toISOString(),
      swaggerUrl: url,
    };
  },
  ["swagger-catalog-v1"],
  {
    tags: [SWAGGER_CACHE_TAG],
    revalidate: 86400, // 24h passive ceiling
  },
);

export async function loadCatalog(): Promise<CatalogResult> {
  return fetchSwaggerCached();
}
