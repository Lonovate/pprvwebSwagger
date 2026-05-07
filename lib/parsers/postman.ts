/**
 * lib/parsers/postman.ts
 * Converts a Postman Collection v2.1 JSON into SourceSwagger.
 *
 * Mapping:
 *   collection.info.name       → info.title
 *   collection.item[] (folders) → tags
 *   request.method + url       → path + method
 *   request.body.raw (JSON)    → requestBody schema (inferred)
 *   request.header[]           → parameters (header)
 *   request.url.query[]        → parameters (query)
 *   collection.auth / request.auth → securitySchemes
 *   collection.variable[]      → server URL construction
 */

import type { SourceSwagger, OperationObject, OpenAPIComponents } from "@/lib/catalog/types";
import type { Parser, ParseInput, ParsedSource } from "./index";

// ─── Postman types (minimal) ─────────────────────────────────────────────────

interface PostmanCollection {
  info: { name: string; description?: string; schema?: string };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[]; // folder
  request?: PostmanRequest;
  response?: PostmanResponse[];
}

interface PostmanRequest {
  method: string;
  url: PostmanUrl | string;
  header?: PostmanKV[];
  body?: PostmanBody;
  description?: string;
  auth?: PostmanAuth;
}

interface PostmanResponse {
  name?: string;
  status?: string;
  code?: number;
  body?: string;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanKV[];
  variable?: PostmanKV[];
}

interface PostmanKV {
  key: string;
  value?: string;
  description?: string;
  disabled?: boolean;
  type?: string;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
  options?: { raw?: { language?: string } };
}

interface PostmanAuth {
  type: string;
  bearer?: PostmanKV[];
  basic?: PostmanKV[];
  apikey?: PostmanKV[];
}

interface PostmanVariable {
  key: string;
  value?: string;
}

// ─── Conversion logic ────────────────────────────────────────────────────────

function resolveVariables(text: string, vars: Map<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars.get(key) ?? `{${key}}`);
}

function normalizeUrl(
  url: PostmanUrl | string,
  vars: Map<string, string>,
): { path: string; baseUrl: string; queryParams: PostmanKV[] } {
  if (typeof url === "string") {
    const resolved = resolveVariables(url, vars);
    try {
      const u = new URL(resolved);
      return {
        path: u.pathname || "/",
        baseUrl: `${u.protocol}//${u.host}`,
        queryParams: [],
      };
    } catch {
      return { path: resolved, baseUrl: "", queryParams: [] };
    }
  }

  const pathParts = (url.path ?? []).map((p) => {
    const resolved = resolveVariables(p, vars);
    // Convert :param to {param}
    return resolved.startsWith(":") ? `{${resolved.slice(1)}}` : resolved;
  });
  const path = "/" + pathParts.join("/");

  let baseUrl = "";
  if (url.protocol && url.host) {
    const host = url.host.map((h) => resolveVariables(h, vars)).join(".");
    baseUrl = `${resolveVariables(url.protocol, vars)}://${host}`;
  } else if (url.raw) {
    try {
      const resolved = resolveVariables(url.raw, vars);
      const u = new URL(resolved);
      baseUrl = `${u.protocol}//${u.host}`;
    } catch { /* ignore */ }
  }

  const queryParams = (url.query ?? []).filter((q) => !q.disabled);

  return { path, baseUrl, queryParams };
}

function inferSchemaFromExample(jsonStr: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(jsonStr);
    return inferSchema(obj);
  } catch {
    return null;
  }
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "string", nullable: true };
  if (Array.isArray(value)) {
    const itemSchema = value.length > 0 ? inferSchema(value[0]) : { type: "object" };
    return { type: "array", items: itemSchema };
  }
  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
    }
    return { type: "object", properties };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function convertAuth(auth: PostmanAuth | undefined): Record<string, unknown> | null {
  if (!auth) return null;
  switch (auth.type) {
    case "bearer":
      return { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } };
    case "basic":
      return { BasicAuth: { type: "http", scheme: "basic" } };
    case "apikey": {
      const keyEntry = auth.apikey?.find((a) => a.key === "key");
      const inEntry = auth.apikey?.find((a) => a.key === "in");
      return {
        ApiKeyAuth: {
          type: "apiKey",
          in: inEntry?.value ?? "header",
          name: keyEntry?.value ?? "X-API-Key",
        },
      };
    }
    default:
      return null;
  }
}

interface FlatRequest {
  tag: string;
  name: string;
  description?: string;
  request: PostmanRequest;
  responses?: PostmanResponse[];
}

function flattenItems(items: PostmanItem[], parentTag?: string): FlatRequest[] {
  const result: FlatRequest[] = [];
  for (const item of items) {
    if (item.item) {
      // Folder — use folder name as tag
      result.push(...flattenItems(item.item, item.name));
    } else if (item.request) {
      result.push({
        tag: parentTag ?? "Default",
        name: item.name,
        description: item.request.description ?? item.description,
        request: item.request,
        responses: item.response,
      });
    }
  }
  return result;
}

function convert(collection: PostmanCollection): ParsedSource {
  const vars = new Map<string, string>();
  for (const v of collection.variable ?? []) {
    if (v.value) vars.set(v.key, v.value);
  }

  const requests = flattenItems(collection.item);

  const paths: Record<string, Record<string, OperationObject>> = {};
  const tags = new Set<string>();
  let baseUrl = "";

  for (const req of requests) {
    tags.add(req.tag);
    const method = req.request.method.toLowerCase();
    const { path, baseUrl: reqBase, queryParams } = normalizeUrl(req.request.url, vars);

    if (!baseUrl && reqBase) baseUrl = reqBase;

    const operation: OperationObject = {
      tags: [req.tag],
      summary: req.name,
      description: req.description,
    };

    // Parameters (query + header)
    const params: unknown[] = [];
    for (const q of queryParams) {
      params.push({
        name: q.key,
        in: "query",
        description: q.description ?? "",
        schema: { type: "string" },
        example: q.value ? resolveVariables(q.value, vars) : undefined,
      });
    }
    for (const h of req.request.header ?? []) {
      if (h.disabled) continue;
      if (["content-type", "authorization"].includes(h.key.toLowerCase())) continue;
      params.push({
        name: h.key,
        in: "header",
        description: h.description ?? "",
        schema: { type: "string" },
        example: h.value ? resolveVariables(h.value, vars) : undefined,
      });
    }
    if (params.length > 0) operation.parameters = params;

    // Request body
    if (req.request.body?.raw) {
      const rawResolved = resolveVariables(req.request.body.raw, vars);
      const schema = inferSchemaFromExample(rawResolved);
      if (schema) {
        operation.requestBody = {
          content: {
            "application/json": {
              schema,
              example: JSON.parse(rawResolved),
            },
          },
        };
      }
    }

    // Responses from saved examples
    const responses: Record<string, unknown> = {};
    if (req.responses && req.responses.length > 0) {
      for (const resp of req.responses) {
        const code = String(resp.code ?? 200);
        responses[code] = {
          description: resp.name ?? resp.status ?? "Response",
        };
      }
    } else {
      responses["200"] = { description: "Successful response" };
    }
    operation.responses = responses;

    if (!paths[path]) paths[path] = {};
    paths[path][method] = operation;
  }

  // Security schemes
  const securitySchemes = convertAuth(collection.auth);
  const components: OpenAPIComponents = {};
  if (securitySchemes) {
    components.securitySchemes = securitySchemes;
  }

  const swagger: SourceSwagger = {
    openapi: "3.0.3",
    info: {
      title: collection.info.name,
      version: "1.0.0",
      description: collection.info.description,
    },
    servers: baseUrl ? [{ url: baseUrl }] : undefined,
    paths,
    components,
    tags: [...tags].sort().map((name) => ({ name })),
  };

  return {
    swagger,
    baseUrl,
    sourceFormat: "postman",
    sourceLabel: `Postman: ${collection.info.name}`,
  };
}

// ─── Parser export ───────────────────────────────────────────────────────────

export const postmanParser: Parser = {
  format: "postman",
  label: "Postman Collection",

  async parse(input: ParseInput): Promise<ParsedSource> {
    let collection: PostmanCollection;

    if (input.url) {
      const r = await fetch(input.url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${input.url}`);
      collection = (await r.json()) as PostmanCollection;
    } else if (input.json) {
      collection = input.json as PostmanCollection;
    } else if (input.text) {
      collection = JSON.parse(input.text) as PostmanCollection;
    } else {
      throw new Error("Postman parser requires a URL, JSON, or text input.");
    }

    // Handle Postman export wrapper: { collection: { ... } }
    if ("collection" in collection && !("info" in collection)) {
      collection = (collection as unknown as { collection: PostmanCollection }).collection;
    }

    if (!collection.info?.name) {
      throw new Error("Invalid Postman collection: missing info.name");
    }

    return convert(collection);
  },
};
