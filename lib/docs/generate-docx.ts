/**
 * lib/docs/generate-docx.ts
 * --------------------------------------------------------------------------
 * Generates a .docx endpoint reference document from the source swagger,
 * matching the structure of the original endpoints.md.docx:
 *
 *   H1: MiddleWare API — Endpoint Reference
 *   Summary line + base URL / auth / content-type
 *   H2: Table of contents (tag names)
 *   For each tag:
 *     H2: Tag name
 *     For each endpoint:
 *       H3: METHOD /path
 *       Body: Key + "What it does" description
 *       If POST/PUT/PATCH with requestBody:
 *         "Body schema: SchemaName"
 *         Table: Field | Type | Required | Description
 *         "Example body:" + JSON (with nested objects fully expanded)
 *       If GET (no body):
 *         "No body required."
 * --------------------------------------------------------------------------
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { SourceSwagger } from "@/lib/catalog/types";

const BASE_URL = "https://pprvmw.com";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

interface EndpointInfo {
  method: string;
  path: string;
  tag: string;
  summary?: string;
  description?: string;
  requestBody?: unknown;
  parameters?: unknown[];
}

// ─── Schema helpers ──────────────────────────────────────────────────────────

type SchemaObj = Record<string, unknown>;
type Schemas = Record<string, SchemaObj>;

function getSchemas(swagger: SourceSwagger): Schemas {
  return (swagger.components?.schemas ?? {}) as Schemas;
}

/** Resolve a $ref string to the actual schema object. */
function resolveRef(ref: string, schemas: Schemas): SchemaObj | null {
  const name = ref.split("/").pop()!;
  return schemas[name] ?? null;
}

function resolveRefName(ref: string): string {
  return ref.split("/").pop()!;
}

// ─── Type formatting (matches endpoints.json style) ──────────────────────────

function formatType(prop: SchemaObj, schemas: Schemas): string {
  if (prop.$ref) {
    const resolved = resolveRef(prop.$ref as string, schemas);
    if (resolved?.properties) {
      // Inline compact representation for small sub-objects
      const keys = Object.keys(resolved.properties as object);
      if (keys.length <= 3) {
        const parts = keys.map((k) => {
          const p = (resolved.properties as Record<string, SchemaObj>)[k];
          return `${k}:${(p.type as string) ?? "string"}`;
        });
        return `{${parts.join(",")}}`;
      }
    }
    return resolveRefName(prop.$ref as string);
  }

  const type = (prop.type as string) ?? "object";
  const format = prop.format as string | undefined;

  if (type === "array") {
    const items = prop.items as SchemaObj | undefined;
    if (!items) return "array";
    if (items.$ref) {
      const resolved = resolveRef(items.$ref as string, schemas);
      if (resolved?.properties) {
        const keys = Object.keys(resolved.properties as object);
        if (keys.length <= 3) {
          const parts = keys.map((k) => {
            const p = (resolved.properties as Record<string, SchemaObj>)[k];
            return `${k}:${(p.type as string) ?? "string"}`;
          });
          return `array<{${parts.join(",")}}>`;
        }
      }
      return `array<${resolveRefName(items.$ref as string)}>`;
    }
    const itemFormat = items.format as string | undefined;
    return `array<${items.type ?? "object"}${itemFormat ? `<${itemFormat}>` : ""}>`;
  }

  if (prop.enum) {
    return `enum<${(prop.enum as string[]).join("|")}>`;
  }

  if (format) return `${type}<${format}>`;
  return type;
}

// ─── Description generation ──────────────────────────────────────────────────

/** Generate a human-readable description from method + path when none exists. */
function generateDescription(ep: EndpointInfo): string {
  if (ep.summary && ep.description) {
    return `${ep.summary}. ${ep.description}`;
  }
  if (ep.summary) return ep.summary;
  if (ep.description) return ep.description;

  // Auto-generate from path
  const segments = ep.path.split("/").filter((s) => s && !s.startsWith("{"));
  const lastSegment = segments[segments.length - 1] ?? "";

  // Convert PascalCase/camelCase to words
  const words = lastSegment
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

  const method = ep.method.toUpperCase();
  switch (method) {
    case "GET":
      return `Retrieve ${words}`;
    case "POST":
      return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
    case "PUT":
    case "PATCH":
      return `Update ${words}`;
    case "DELETE":
      return `Delete ${words}`;
    default:
      return words;
  }
}

// ─── Example body generation (recursive $ref resolution) ─────────────────────

const MAX_DEPTH = 4;

function exampleValue(
  prop: SchemaObj,
  name: string,
  schemas: Schemas,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return null;

  // If there's an explicit example, use it
  if (prop.example !== undefined) return prop.example;
  if (prop.enum) return (prop.enum as unknown[])[0];

  // Resolve $ref
  if (prop.$ref) {
    const resolved = resolveRef(prop.$ref as string, schemas);
    if (resolved) return buildExampleFromSchema(resolved, schemas, depth + 1);
    return {};
  }

  const type = (prop.type as string) ?? "string";
  const format = prop.format as string | undefined;

  switch (type) {
    case "string":
      if (format === "uuid" || format === "guid")
        return "00000000-0000-0000-0000-000000000000";
      if (format === "date-time") return "2025-12-01T00:00:00Z";
      if (format === "date") return "2025-12-01";
      if (format === "time") return "10:00:00";
      if (name.toLowerCase().includes("email")) return "user@example.com";
      if (name.toLowerCase().includes("phone")) return "+1-555-0100";
      if (name.toLowerCase().includes("url") || name.toLowerCase().includes("image"))
        return "https://example.com/image.png";
      if (name.toLowerCase().includes("name")) return "Example Name";
      if (name.toLowerCase().includes("description")) return "Description text";
      return "string";
    case "integer":
      return format === "int64" ? 0 : 0;
    case "number":
      return 0;
    case "boolean":
      return true;
    case "array": {
      const items = prop.items as SchemaObj | undefined;
      if (!items) return [];
      const itemExample = exampleValue(items, name, schemas, depth + 1);
      return [itemExample];
    }
    case "object": {
      if (prop.properties) {
        return buildExampleFromSchema(prop, schemas, depth + 1);
      }
      return {};
    }
    default:
      return null;
  }
}

function buildExampleFromSchema(
  schema: SchemaObj | null,
  schemas: Schemas,
  depth = 0,
): Record<string, unknown> | null {
  if (!schema || depth > MAX_DEPTH) return null;
  const properties = schema.properties as Record<string, SchemaObj> | undefined;
  if (!properties) return null;

  const example: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(properties)) {
    example[name] = exampleValue(prop, name, schemas, depth);
  }
  return example;
}

// ─── Endpoint extraction ─────────────────────────────────────────────────────

function extractEndpointsByTag(swagger: SourceSwagger): Map<string, EndpointInfo[]> {
  const byTag = new Map<string, EndpointInfo[]>();

  for (const [path, pathItem] of Object.entries(swagger.paths ?? {})) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;

      const tags = op.tags?.length ? op.tags : ["Untagged"];
      for (const tag of tags) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push({
          method: method.toUpperCase(),
          path,
          tag,
          summary: op.summary,
          description: op.description,
          requestBody: op.requestBody,
          parameters: op.parameters as unknown[],
        });
      }
    }
  }

  return new Map([...byTag.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/** Derive operation key like "Tag.OperationName" from path. */
function operationKey(tag: string, path: string): string {
  const segments = path.split("/").filter(Boolean);
  const meaningful = segments.filter((s) => !s.startsWith("{"));
  const lastSegment = meaningful[meaningful.length - 1] ?? path;
  return `${tag}.${lastSegment}`;
}

/** Get request body schema info. */
function getBodySchema(
  ep: EndpointInfo,
  schemas: Schemas,
): { schemaName: string; schema: SchemaObj | null } | null {
  const rb = ep.requestBody as SchemaObj | undefined;
  if (!rb) return null;

  const content = rb.content as Record<string, SchemaObj> | undefined;
  if (!content) return null;

  const json = (content["application/json"] ?? content["*/*"]) as SchemaObj | undefined;
  if (!json) return null;

  const schema = json.schema as SchemaObj | undefined;
  if (!schema) return null;

  if (schema.$ref) {
    const name = resolveRefName(schema.$ref as string);
    const resolved = schemas[name] ?? null;
    return { schemaName: name, schema: resolved };
  }

  // Inline schema (no $ref)
  return { schemaName: "(inline)", schema };
}

// ─── DOCX table builder ─────────────────────────────────────────────────────

function cell(text: string, bold = false): TableCell {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  return new TableCell({
    borders: { top: border, bottom: border, left: border, right: border },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 20, font: "Calibri" })],
      }),
    ],
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function buildFieldTable(schema: SchemaObj, schemas: Schemas): Table | null {
  const properties = schema.properties as Record<string, SchemaObj> | undefined;
  if (!properties || Object.keys(properties).length === 0) return null;

  const required = (schema.required as string[]) ?? [];

  const headerRow = new TableRow({
    children: [
      cell("Field", true),
      cell("Type", true),
      cell("Required", true),
      cell("Description", true),
    ],
  });

  const dataRows = Object.entries(properties).map(([name, prop]) => {
    const isRequired = required.includes(name) ? "yes" : "no";
    const desc = (prop.description as string) ?? "";
    return new TableRow({
      children: [
        cell(name),
        cell(formatType(prop, schemas)),
        cell(isRequired),
        cell(desc),
      ],
    });
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─── Main export: generate .docx ────────────────────────────────────────────

export async function generateEndpointsDocx(swagger: SourceSwagger): Promise<Buffer> {
  const schemas = getSchemas(swagger);
  const endpointsByTag = extractEndpointsByTag(swagger);
  const allTags = [...endpointsByTag.keys()];

  let totalEndpoints = 0;
  for (const eps of endpointsByTag.values()) totalEndpoints += eps.length;

  const children: (Paragraph | Table)[] = [];

  // --- Title ---
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: `${swagger.info?.title ?? "API"} — Endpoint Reference`,
          bold: true,
        }),
      ],
    }),
  );

  // --- Summary ---
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Auto-generated from swagger. ${totalEndpoints} endpoints across ${allTags.length} tags.`,
        }),
      ],
    }),
  );
  children.push(new Paragraph({}));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Base URL: ${BASE_URL}\nAuth: Bearer JWT in Authorization header (obtain via /Login)\nContent-Type: application/json`,
        }),
      ],
    }),
  );

  // --- Table of contents ---
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Table of contents" })],
    }),
  );
  for (const tag of allTags) {
    children.push(new Paragraph({ children: [new TextRun({ text: tag })] }));
  }
  children.push(new Paragraph({}));
  children.push(new Paragraph({}));

  // --- Per-tag sections ---
  for (const [tag, endpoints] of endpointsByTag) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: tag })],
      }),
    );

    for (const ep of endpoints) {
      // H3: METHOD /path
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: `${ep.method} ${ep.path}` })],
        }),
      );

      // Key + description (auto-generated if missing)
      const key = operationKey(tag, ep.path);
      const desc = generateDescription(ep);
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Key: ${key}`, bold: true }),
            new TextRun({ text: `\nWhat it does: ${desc}` }),
          ],
        }),
      );
      children.push(new Paragraph({}));

      const hasBody = ["POST", "PUT", "PATCH"].includes(ep.method);

      if (hasBody) {
        const bodyInfo = getBodySchema(ep, schemas);

        if (bodyInfo) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Body schema: " }),
                new TextRun({ text: bodyInfo.schemaName, bold: true }),
              ],
            }),
          );
          children.push(new Paragraph({}));

          // Field table
          if (bodyInfo.schema) {
            const table = buildFieldTable(bodyInfo.schema, schemas);
            if (table) {
              children.push(table);
            }
          }
          children.push(new Paragraph({}));

          // Example body (recursively expanded)
          const example = buildExampleFromSchema(bodyInfo.schema, schemas);
          if (example) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: "Example body:" })],
              }),
            );
            children.push(new Paragraph({}));

            const jsonLines = JSON.stringify(example, null, 2).split("\n");
            for (const line of jsonLines) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: line, font: "Courier New", size: 20 }),
                  ],
                }),
              );
              children.push(new Paragraph({}));
            }
          }
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "Body schema not specified." })],
            }),
          );
          children.push(new Paragraph({}));
        }
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "No body required." })],
          }),
        );
        children.push(new Paragraph({}));
      }

      children.push(new Paragraph({}));
    }
  }

  const doc = new Document({
    sections: [{ children: children as Paragraph[] }],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}

// ─── Also export: generate endpoints.json ────────────────────────────────────

export interface EndpointJsonEntry {
  path: string;
  method: string;
  tag: string;
  summary: string;
  description?: string;
  requiresBody: boolean;
  bodySchema?: string;
  fields?: Record<string, { type: string; required: boolean; description?: string }>;
  exampleBody?: Record<string, unknown>;
}

export function generateEndpointsJson(swagger: SourceSwagger): object {
  const schemas = getSchemas(swagger);
  const endpointsByTag = extractEndpointsByTag(swagger);

  let totalEndpoints = 0;
  for (const eps of endpointsByTag.values()) totalEndpoints += eps.length;

  // Common schemas (frequently reused small ones)
  const commonSchemaNames = [
    "GuidIdentifier",
    "NotNullGuidIdentifier",
    "LongIdentifier",
    "NotNullLongIdentifier",
  ];
  const commonSchemas: Record<string, Record<string, string>> = {};
  for (const name of commonSchemaNames) {
    const s = schemas[name];
    if (!s?.properties) continue;
    const entry: Record<string, string> = {};
    const props = s.properties as Record<string, SchemaObj>;
    const req = (s.required as string[]) ?? [];
    for (const [k, v] of Object.entries(props)) {
      const t = formatType(v, schemas);
      entry[k] = req.includes(k) ? `${t} (required)` : t;
    }
    commonSchemas[name] = entry;
  }

  // Build endpoints map
  const endpoints: Record<string, EndpointJsonEntry> = {};

  for (const [tag, eps] of endpointsByTag) {
    for (const ep of eps) {
      const key = operationKey(tag, ep.path);
      const hasBody = ["POST", "PUT", "PATCH"].includes(ep.method);
      const bodyInfo = hasBody ? getBodySchema(ep, schemas) : null;

      const entry: EndpointJsonEntry = {
        path: ep.path,
        method: ep.method,
        tag,
        summary: generateDescription(ep),
        requiresBody: hasBody,
      };

      // Add longer description if both summary and description exist
      if (ep.summary && ep.description) {
        entry.description = ep.description;
      }

      if (bodyInfo) {
        entry.bodySchema = bodyInfo.schemaName;

        // Fields
        if (bodyInfo.schema?.properties) {
          const props = bodyInfo.schema.properties as Record<string, SchemaObj>;
          const req = (bodyInfo.schema.required as string[]) ?? [];
          const fields: Record<string, { type: string; required: boolean; description?: string }> = {};
          for (const [name, prop] of Object.entries(props)) {
            const f: { type: string; required: boolean; description?: string } = {
              type: formatType(prop, schemas),
              required: req.includes(name),
            };
            if (prop.description) f.description = prop.description as string;
            fields[name] = f;
          }
          entry.fields = fields;
        }

        // Example body (recursive)
        const example = buildExampleFromSchema(bodyInfo.schema, schemas);
        if (example) entry.exampleBody = example;
      }

      endpoints[key] = entry;
    }
  }

  return {
    info: {
      title: `${swagger.info?.title ?? "API"} - Bot Reference`,
      version: swagger.info?.version ?? "1.0",
      baseUrl: BASE_URL,
      description:
        "Bot-friendly compiled reference of all endpoints. Look up by key (Tag.Operation). Each entry has path, method, what it does, fields with type/required/description, and a ready-to-send exampleBody.",
      auth: "Bearer JWT in Authorization header (obtain via /Login)",
      contentType: "application/json",
      typeNotation:
        "string | string<uuid> | string<date-time> | string<date> | string<time> | integer<int32> | integer<int64> | number<double> | boolean | array<T> | object | enum<a|b|c>",
      totalEndpoints,
      generatedAt: new Date().toISOString().split("T")[0],
    },
    commonSchemas,
    endpoints,
  };
}
