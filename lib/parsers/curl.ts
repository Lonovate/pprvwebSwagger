/**
 * lib/parsers/curl.ts
 * Converts one or more cURL commands into SourceSwagger.
 *
 * Supports common curl flags: -X, -H, -d/--data, --data-raw, -u
 * Multiple commands separated by newlines or semicolons.
 */

import type { SourceSwagger, OperationObject } from "@/lib/catalog/types";
import type { Parser, ParseInput, ParsedSource } from "./index";

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: { type: "basic"; user: string; pass: string };
}

function parseSingleCurl(cmd: string): ParsedCurl | null {
  const trimmed = cmd.trim().replace(/\\\n/g, " "); // join line continuations
  if (!trimmed.startsWith("curl")) return null;

  // Tokenize respecting quotes
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of trimmed) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if ((ch === " " || ch === "\t") && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  // Remove "curl" token
  tokens.shift();

  let method = "GET";
  let url = "";
  const headers: Record<string, string> = {};
  let body: string | undefined;
  let auth: ParsedCurl["auth"];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if ((t === "-X" || t === "--request") && next) {
      method = next.toUpperCase();
      i++;
    } else if ((t === "-H" || t === "--header") && next) {
      const colonIdx = next.indexOf(":");
      if (colonIdx > 0) {
        headers[next.slice(0, colonIdx).trim()] = next.slice(colonIdx + 1).trim();
      }
      i++;
    } else if ((t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary") && next) {
      body = next;
      if (method === "GET") method = "POST";
      i++;
    } else if ((t === "-u" || t === "--user") && next) {
      const [user, pass] = next.split(":");
      auth = { type: "basic", user, pass: pass ?? "" };
      i++;
    } else if (!t.startsWith("-") && !url) {
      url = t;
    }
  }

  if (!url) return null;

  return { method, url, headers, body, auth };
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

function convert(commands: ParsedCurl[]): ParsedSource {
  const paths: Record<string, Record<string, OperationObject>> = {};
  const tags = new Set<string>();
  let baseUrl = "";
  const hasBasicAuth = commands.some((c) => c.auth?.type === "basic");
  const hasBearer = commands.some((c) =>
    Object.entries(c.headers).some(
      ([k, v]) => k.toLowerCase() === "authorization" && v.toLowerCase().startsWith("bearer"),
    ),
  );

  for (const cmd of commands) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cmd.url);
    } catch {
      continue;
    }

    if (!baseUrl) baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const pathname = parsedUrl.pathname || "/";
    const method = cmd.method.toLowerCase();

    const segments = pathname.split("/").filter(Boolean);
    const tag = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : "Default";
    tags.add(tag);

    const lastSeg = segments[segments.length - 1] ?? pathname;

    const op: OperationObject = {
      tags: [tag],
      summary: `${cmd.method} ${lastSeg}`,
      responses: { "200": { description: "Successful response" } },
    };

    // Query params from URL
    const queryParams = [...parsedUrl.searchParams.entries()];
    if (queryParams.length > 0) {
      op.parameters = queryParams.map(([name, value]) => ({
        name,
        in: "query",
        schema: { type: "string" },
        example: value,
      }));
    }

    // Custom headers as parameters
    const headerParams = Object.entries(cmd.headers).filter(
      ([k]) => !["content-type", "authorization", "accept"].includes(k.toLowerCase()),
    );
    if (headerParams.length > 0) {
      op.parameters = [
        ...(op.parameters ?? []),
        ...headerParams.map(([name, value]) => ({
          name,
          in: "header",
          schema: { type: "string" },
          example: value,
        })),
      ];
    }

    // Body
    if (cmd.body) {
      try {
        const parsed = JSON.parse(cmd.body);
        op.requestBody = {
          content: {
            "application/json": {
              schema: inferSchema(parsed),
              example: parsed,
            },
          },
        };
      } catch {
        // Not JSON — treat as form data
        op.requestBody = {
          content: { "text/plain": { schema: { type: "string" }, example: cmd.body } },
        };
      }
    }

    if (!paths[pathname]) paths[pathname] = {};
    paths[pathname][method] = op;
  }

  const securitySchemes: Record<string, unknown> = {};
  if (hasBearer) securitySchemes.BearerAuth = { type: "http", scheme: "bearer" };
  if (hasBasicAuth) securitySchemes.BasicAuth = { type: "http", scheme: "basic" };

  const swagger: SourceSwagger = {
    openapi: "3.0.3",
    info: {
      title: "cURL Import",
      version: "1.0.0",
      description: `Imported from ${commands.length} cURL command${commands.length > 1 ? "s" : ""}.`,
    },
    servers: baseUrl ? [{ url: baseUrl }] : undefined,
    paths,
    components: Object.keys(securitySchemes).length > 0 ? { securitySchemes } : {},
    tags: [...tags].sort().map((name) => ({ name })),
  };

  return {
    swagger,
    baseUrl,
    sourceFormat: "curl",
    sourceLabel: `cURL: ${commands.length} command${commands.length > 1 ? "s" : ""}`,
  };
}

export const curlParser: Parser = {
  format: "curl",
  label: "cURL Commands",

  async parse(input: ParseInput): Promise<ParsedSource> {
    const text = input.text;
    if (!text) throw new Error("cURL parser requires text input with curl commands.");

    // Split on lines starting with "curl " (handles multi-command input)
    const parts = text.split(/(?=^curl\s)/m).filter((s) => s.trim());
    const parsed = parts.map(parseSingleCurl).filter(Boolean) as ParsedCurl[];

    if (parsed.length === 0) {
      throw new Error("No valid cURL commands found in input.");
    }

    return convert(parsed);
  },
};
