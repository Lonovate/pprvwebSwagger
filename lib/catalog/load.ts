/**
 * lib/catalog/load.ts (legacy shim)
 * The canonical loader is now lib/catalog/runtime.ts. This shim is kept
 * only for backwards compatibility — re-export `loadCatalog` from there.
 */

export { loadCatalog, SWAGGER_CACHE_TAG, DEFAULT_SWAGGER_URL } from "./runtime";
export type { CatalogResult } from "./runtime";
