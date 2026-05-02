/**
 * lib/catalog/load.ts
 * Loads the normalized catalog (catalog.json) into memory.
 *
 * We import the JSON directly so Next.js bundles it with the route handler
 * and Vercel's outputFileTracing doesn't have to guess. JSON parse happens
 * once at module init.
 */

import catalogData from "./catalog.json";
import type { SourceSwagger } from "./types";

const CATALOG = catalogData as unknown as SourceSwagger;

export function loadCatalog(): SourceSwagger {
  return CATALOG;
}
