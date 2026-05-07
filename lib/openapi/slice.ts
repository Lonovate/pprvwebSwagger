/**
 * lib/openapi/slice.ts
 * --------------------------------------------------------------------------
 * Build a themed OpenAPI 3.x schema from the source swagger and a resolved
 * theme. The theme map is now passed in (not imported), so the slicer is
 * decoupled from any static config.
 *
 * Responsibilities:
 *   1. Filter source paths by the theme's tags + allowedMethods.
 *   2. Synthesize deterministic operationIds (source has none).
 *   3. Recursively walk $ref graph; collect ONLY referenced components.
 *   4. Always preserve components.securitySchemes (Bearer auth).
 *   5. Inject servers: [{ url: <serverUrl> }].
 * --------------------------------------------------------------------------
 */

import type {
  ComponentsSection,
  HttpMethod,
  OpenAPIComponents,
  OperationObject,
  PathItem,
  SourceSwagger,
  ThemedSchema,
} from "../catalog/types";
import type { ResolvedTheme } from "../themes/registry";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

export interface SliceOptions {
  serverUrl?: string;
}

const DEFAULT_SERVER_URL = process.env.SOURCE_API_URL || "https://pprvmw.com";

// ---------- operationId generation -----------------------------------------

const NON_ALNUM = /[^A-Za-z0-9]+/g;
const TRIM_UNDERSCORE = /^_+|_+$/g;

export function makeOperationId(
  tag: string,
  method: string,
  path: string,
): string {
  const cleanPath = path.replace(NON_ALNUM, "_").replace(TRIM_UNDERSCORE, "");
  return `${tag}_${method.toUpperCase()}_${cleanPath}`;
}

// ---------- $ref walker ----------------------------------------------------

interface RefInfo {
  section: string;
  name: string;
}

const REF_RE = /^#\/components\/([^/]+)\/(.+)$/;

export function parseRef(ref: string): RefInfo | null {
  const m = REF_RE.exec(ref);
  if (!m) return null;
  return { section: m[1], name: decodeURIComponent(m[2]) };
}

function collectRefs(node: unknown, out: Set<string>): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, out);
    return;
  }
  if (typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$ref" && typeof v === "string") {
      out.add(v);
    } else if (k === "discriminator" && v && typeof v === "object") {
      const mapping = (v as Record<string, unknown>).mapping;
      if (mapping && typeof mapping === "object") {
        for (const mv of Object.values(mapping as Record<string, unknown>)) {
          if (typeof mv === "string" && mv.startsWith("#/")) out.add(mv);
        }
      }
      collectRefs(v, out);
    } else {
      collectRefs(v, out);
    }
  }
}

export function pickReferencedComponents(
  components: OpenAPIComponents | undefined,
  rootObjects: unknown[],
): OpenAPIComponents {
  const result: OpenAPIComponents = {};
  if (!components) return result;

  const queue = new Set<string>();
  for (const r of rootObjects) collectRefs(r, queue);

  const visited = new Set<string>();

  while (queue.size > 0) {
    const next = queue.values().next().value as string;
    queue.delete(next);
    if (visited.has(next)) continue;
    visited.add(next);

    const info = parseRef(next);
    if (!info) continue;
    const section = components[info.section];
    if (!section) continue;
    const component = (section as ComponentsSection)[info.name];
    if (component === undefined) continue;

    (result[info.section] ??= {} as ComponentsSection)[info.name] = component;

    const nestedRefs = new Set<string>();
    collectRefs(component, nestedRefs);
    for (const r of nestedRefs) {
      if (!visited.has(r)) queue.add(r);
    }
  }

  return result;
}

// ---------- main slicer ----------------------------------------------------

export function buildThemedSchema(
  themeKey: string,
  source: SourceSwagger,
  themes: Record<string, ResolvedTheme>,
  options: SliceOptions = {},
): ThemedSchema {
  const cfg = themes[themeKey];
  if (!cfg) {
    throw new Error(`Unknown theme: ${themeKey}`);
  }

  const allowedMethods = new Set(cfg.allowedMethods.map((m) => m.toUpperCase()));
  const filteredPaths: Record<string, Record<string, OperationObject>> = {};

  for (const [pathStr, item] of Object.entries(source.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const [method, op] of Object.entries(item as PathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (typeof op !== "object" || op === null) continue;

      const opObj = op as OperationObject;
      const M = method.toUpperCase() as HttpMethod;
      if (!allowedMethods.has(M)) continue;

      const opTags = opObj.tags;
      const matchedTag = opTags?.find((t) => cfg.tags.includes(t));
      if (!matchedTag) continue;

      const enriched: OperationObject = { ...opObj };
      if (!enriched.operationId) {
        enriched.operationId = makeOperationId(matchedTag, M, pathStr);
      }

      filteredPaths[pathStr] ??= {};
      filteredPaths[pathStr][method] = enriched;
    }
  }

  const components = pickReferencedComponents(source.components, [filteredPaths]);

  if (source.components?.securitySchemes) {
    components.securitySchemes = { ...source.components.securitySchemes };
  }

  const themed: ThemedSchema = {
    openapi: source.openapi || "3.0.1",
    info: {
      title: cfg.title,
      description: cfg.description,
      version: "1.0.0",
    },
    servers: [{ url: options.serverUrl ?? DEFAULT_SERVER_URL }],
    paths: filteredPaths,
    components,
  };

  if (source.security) themed.security = source.security;

  return themed;
}
