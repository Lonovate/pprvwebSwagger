/**
 * lib/openapi/slice.ts
 * --------------------------------------------------------------------------
 * Build a themed OpenAPI 3.x schema by:
 *   1. Filtering source swagger paths by the theme's tags + allowedMethods.
 *   2. Synthesizing deterministic operationIds (source has none).
 *   3. Recursively walking $ref graph to collect ONLY referenced components.
 *   4. Always preserving components.securitySchemes (Bearer auth in our case).
 *   5. Injecting servers: [{ url: <serverUrl> }].
 *
 * The ref walker handles:
 *   - Standard $ref like "#/components/schemas/Foo"
 *   - Discriminator mapping references (string values that look like refs)
 *   - Circular references (visited set prevents infinite loops)
 *   - Nested arrays + objects of arbitrary depth
 *
 * Refs that don't point at #/components/<section>/<name> are silently
 * skipped — the source becomes the resulting schema's responsibility.
 * --------------------------------------------------------------------------
 */

import type {
  ComponentsSection,
  OpenAPIComponents,
  OperationObject,
  PathItem,
  SourceSwagger,
  ThemedSchema,
} from "../catalog/types";
import {
  THEMES,
  type HttpMethod,
  type ThemeConfig,
} from "@/config/themes";

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
  /** Override config; primarily for tests */
  themesOverride?: Record<string, ThemeConfig>;
}

const DEFAULT_SERVER_URL = "https://pprvmw.com";

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
      // discriminator.mapping has values that are refs (strings)
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

    // Walk this component for nested refs
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
  options: SliceOptions = {},
): ThemedSchema {
  const themesMap = options.themesOverride ?? (THEMES as unknown as Record<string, ThemeConfig>);
  const cfg = themesMap[themeKey];
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

  // Always preserve securitySchemes — VIVI needs it to wire auth even if no
  // operation $refs them directly.
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
