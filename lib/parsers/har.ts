/**
 * lib/parsers/har.ts
 * Converts an HTTP Archive (HAR) file into SourceSwagger.
 *
 * HAR files contain recorded HTTP requests from browser dev tools.
 * We extract unique API endpoints and infer schemas from request/response bodies.
 */

import type { SourceSwagger, OperationObject } from "@/lib/catalog/types";
import type { Parser, ParseInput, ParsedSource } from "./index";

interface HarFile {
  log: {
    entries: HarEntry[];
  };
}

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string }[];
    queryString?: { name: string; value: string }[];
    postData?: { mimeType?: string; text?: string };
  };
  response: {
    status: number;
    statusText: string;
    headers: { name: string; value: string }[];
    content?: { mimeType?: string; text?: string };
  };
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "string", nullable: true };
  if (Array.isArray(value)) {
    return { type: "array", items: value.length > 0 ? inferSchema(value[0]) : { type: "object" } };
  }
  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
    }
    return { type: "object", properties };
  }
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function convert(har: HarFile): ParsedSource {
  const entries = har.log.entries;

  // Deduplicate: same method + path = one endpoint (use first occurrence)
  const seen = new Map<string, { entry: HarEntry; parsedUrl: URL }>();
  let baseUrl = "";

  for (const entry of entries) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(entry.request.url);
    } catch {
      continue;
    }

    // Skip non-API requests (static files, images, etc.)
    const ct = entry.response.headers.find(
      (h) => h.name.toLowerCase() === "content-type",
    )?.value ?? "";
    const isApi = ct.includes("json") || ct.includes("xml") || ct.includes("text/plain");
    const isApiRequest =
      entry.request.postData?.mimeType?.includes("json") ||
      entry.request.method !== "GET";

    if (!isApi && !isApiRequest) continue;

    if (!baseUrl) baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const key = `${entry.request.method.toUpperCase()} ${parsedUrl.pathname}`;
    if (!seen.has(key)) {
      seen.set(key, { entry, parsedUrl });
    }
  }

  // Group by path prefix for tags
  const paths: Record<string, Record<string, OperationObject>> = {};
  const tags = new Set<string>();

  for (const [, { entry, parsedUrl }] of seen) {
    const method = entry.request.method.toLowerCase();
    const pathname = parsedUrl.pathname;

    // Derive tag from first path segment
    const segments = pathname.split("/").filter(Boolean);
    const tag = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : "Default";
    tags.add(tag);

    // Summary from last path segment
    const lastSeg = segments[segments.length - 1] ?? pathname;
    const summary = lastSeg.replace(/([A-Z])/g, " $1").trim();

    const op: OperationObject = {
      tags: [tag],
      summary: `${entry.request.method} ${summary}`,
      responses: {
        [String(entry.response.status)]: {
          description: entry.response.statusText || "Response",
        },
      },
    };

    // Query parameters
    if (entry.request.queryString?.length) {
      op.parameters = entry.request.queryString.map((q) => ({
        name: q.name,
        in: "query",
        schema: { type: "string" },
        example: q.value,
      }));
    }

    // Request body
    if (entry.request.postData?.text && entry.request.postData.mimeType?.includes("json")) {
      try {
        const body = JSON.parse(entry.request.postData.text);
        op.requestBody = {
          content: {
            "application/json": {
              schema: inferSchema(body),
              example: body,
            },
          },
        };
      } catch { /* not JSON */ }
    }

    if (!paths[pathname]) paths[pathname] = {};
    paths[pathname][method] = op;
  }

  const swagger: SourceSwagger = {
    openapi: "3.0.3",
    info: {
      title: "Captured API",
      version: "1.0.0",
      description: `Extracted from HAR file. ${seen.size} unique endpoints captured.`,
    },
    servers: baseUrl ? [{ url: baseUrl }] : undefined,
    paths,
    components: {},
    tags: [...tags].sort().map((name) => ({ name })),
  };

  return {
    swagger,
    baseUrl,
    sourceFormat: "har",
    sourceLabel: `HAR: ${seen.size} endpoints`,
  };
}

export const harParser: Parser = {
  format: "har",
  label: "HAR File",

  async parse(input: ParseInput): Promise<ParsedSource> {
    let har: HarFile;

    if (input.json) {
      har = input.json as HarFile;
    } else if (input.text) {
      har = JSON.parse(input.text) as HarFile;
    } else {
      throw new Error("HAR parser requires a file upload (JSON or text).");
    }

    if (!har.log?.entries) {
      throw new Error("Invalid HAR file: missing log.entries");
    }

    return convert(har);
  },
};
