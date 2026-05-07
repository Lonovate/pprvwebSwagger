/**
 * lib/catalog/runtime.ts
 * --------------------------------------------------------------------------
 * Runtime swagger fetcher. All URLs come from environment variables.
 *
 * 1. Default (cached): fetches from SWAGGER_URL env var,
 *    cached via Next.js Data Cache.
 *
 * 2. Dynamic URL: fetches from any user-provided swagger URL. No caching.
 * --------------------------------------------------------------------------
 */

import { unstable_cache } from "next/cache";
import type { SourceSwagger } from "./types";
import { getEnv } from "@/lib/env";

export const SWAGGER_CACHE_TAG = "swagger-source";

/** @deprecated Use getEnv().SWAGGER_URL instead. Kept for script compatibility. */
export const DEFAULT_SWAGGER_URL = process.env.SWAGGER_URL || "https://pprvmw.com/swagger/v1/swagger.json";

/** Well-known environments shown in the dashboard dropdown. Read from env vars. */
export function getSwaggerEnvironments() {
  const env = getEnv();
  return [
    {
      label: "Production",
      url: env.SWAGGER_URL,
      baseUrl: env.SOURCE_API_URL,
    },
    {
      label: "Development",
      url: env.DEV_SWAGGER_URL,
      baseUrl: env.DEV_API_URL,
    },
  ];
}

export interface CatalogResult {
  swagger: SourceSwagger;
  lastFetched: string;
  swaggerUrl: string;
  baseUrl: string;
}

function getSwaggerUrl(): string {
  return getEnv().SWAGGER_URL;
}

/** Derive the base API URL from a swagger URL. */
export function deriveBaseUrl(swaggerUrl: string): string {
  const envs = getSwaggerEnvironments();
  const known = envs.find((e) => e.url === swaggerUrl);
  if (known) return known.baseUrl;

  try {
    const u = new URL(swaggerUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return getEnv().SOURCE_API_URL;
  }
}

/**
 * Cached swagger fetch for the default environment.
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
      baseUrl: deriveBaseUrl(url),
    };
  },
  ["swagger-catalog-v1"],
  {
    tags: [SWAGGER_CACHE_TAG],
    revalidate: 86400,
  },
);

/** Load catalog from the default (cached) source. */
export async function loadCatalog(): Promise<CatalogResult> {
  return fetchSwaggerCached();
}

/**
 * Load catalog from a specific URL. No caching — always fresh.
 */
export async function loadCatalogFromUrl(swaggerUrl: string): Promise<CatalogResult> {
  const r = await fetch(swaggerUrl, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`[catalog] HTTP ${r.status} fetching ${swaggerUrl}`);
  }
  const swagger = (await r.json()) as SourceSwagger;
  return {
    swagger,
    lastFetched: new Date().toISOString(),
    swaggerUrl,
    baseUrl: deriveBaseUrl(swaggerUrl),
  };
}
