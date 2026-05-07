/**
 * lib/parsers/graphql.ts
 * Converts a GraphQL introspection JSON into SourceSwagger.
 *
 * Mapping:
 *   queries   → GET  /graphql?query=... (tag: Query)
 *   mutations → POST /graphql            (tag: Mutation)
 *   Each field → one "endpoint" with args as parameters/body
 */

import type { SourceSwagger, OperationObject, OpenAPIComponents } from "@/lib/catalog/types";
import type { Parser, ParseInput, ParsedSource } from "./index";

interface GQLSchema {
  data?: { __schema: GQLSchemaInner };
  __schema?: GQLSchemaInner;
}

interface GQLSchemaInner {
  queryType?: { name: string };
  mutationType?: { name: string };
  subscriptionType?: { name: string };
  types: GQLType[];
}

interface GQLType {
  kind: string;
  name: string;
  description?: string;
  fields?: GQLField[];
  inputFields?: GQLInputField[];
  enumValues?: { name: string; description?: string }[];
}

interface GQLField {
  name: string;
  description?: string;
  args?: GQLInputField[];
  type: GQLTypeRef;
}

interface GQLInputField {
  name: string;
  description?: string;
  type: GQLTypeRef;
  defaultValue?: string;
}

interface GQLTypeRef {
  kind: string;
  name?: string;
  ofType?: GQLTypeRef;
}

function resolveTypeName(ref: GQLTypeRef): string {
  if (ref.name) return ref.name;
  if (ref.ofType) {
    const inner = resolveTypeName(ref.ofType);
    if (ref.kind === "NON_NULL") return `${inner}!`;
    if (ref.kind === "LIST") return `[${inner}]`;
    return inner;
  }
  return "Unknown";
}

function gqlTypeToJsonSchema(ref: GQLTypeRef): Record<string, unknown> {
  const unwrapped = unwrapType(ref);
  if (ref.kind === "LIST" || (ref.kind === "NON_NULL" && ref.ofType?.kind === "LIST")) {
    return { type: "array", items: gqlTypeToJsonSchema(unwrapped) };
  }
  switch (unwrapped.name) {
    case "String":
    case "ID":
      return { type: "string" };
    case "Int":
      return { type: "integer" };
    case "Float":
      return { type: "number" };
    case "Boolean":
      return { type: "boolean" };
    default:
      return { type: "object", description: unwrapped.name ?? "object" };
  }
}

function unwrapType(ref: GQLTypeRef): GQLTypeRef {
  if (ref.kind === "NON_NULL" || ref.kind === "LIST") {
    return ref.ofType ? unwrapType(ref.ofType) : ref;
  }
  return ref;
}

function convert(introspection: GQLSchemaInner, baseUrl: string): ParsedSource {
  const typesMap = new Map<string, GQLType>();
  for (const t of introspection.types) {
    typesMap.set(t.name, t);
  }

  const queryTypeName = introspection.queryType?.name ?? "Query";
  const mutationTypeName = introspection.mutationType?.name ?? "Mutation";

  const queryType = typesMap.get(queryTypeName);
  const mutationType = typesMap.get(mutationTypeName);

  const paths: Record<string, Record<string, OperationObject>> = {};
  const tags = new Set<string>();

  // Queries → GET /graphql/{queryName}
  if (queryType?.fields) {
    tags.add("Query");
    for (const field of queryType.fields) {
      if (field.name.startsWith("__")) continue;
      const path = `/graphql/query/${field.name}`;
      const params = (field.args ?? []).map((arg) => ({
        name: arg.name,
        in: "query" as const,
        description: arg.description ?? `Type: ${resolveTypeName(arg.type)}`,
        required: arg.type.kind === "NON_NULL",
        schema: gqlTypeToJsonSchema(arg.type),
      }));

      const op: OperationObject = {
        tags: ["Query"],
        summary: field.name,
        description: field.description ?? `Query: ${field.name} → ${resolveTypeName(field.type)}`,
        parameters: params.length > 0 ? params : undefined,
        responses: { "200": { description: `Returns ${resolveTypeName(field.type)}` } },
      };
      paths[path] = { get: op };
    }
  }

  // Mutations → POST /graphql/mutation/{mutationName}
  if (mutationType?.fields) {
    tags.add("Mutation");
    for (const field of mutationType.fields) {
      if (field.name.startsWith("__")) continue;
      const path = `/graphql/mutation/${field.name}`;

      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const arg of field.args ?? []) {
        properties[arg.name] = {
          ...gqlTypeToJsonSchema(arg.type),
          description: arg.description ?? `Type: ${resolveTypeName(arg.type)}`,
        };
        if (arg.type.kind === "NON_NULL") required.push(arg.name);
      }

      const op: OperationObject = {
        tags: ["Mutation"],
        summary: field.name,
        description: field.description ?? `Mutation: ${field.name} → ${resolveTypeName(field.type)}`,
        responses: { "200": { description: `Returns ${resolveTypeName(field.type)}` } },
      };

      if (Object.keys(properties).length > 0) {
        op.requestBody = {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties,
                ...(required.length > 0 ? { required } : {}),
              },
            },
          },
        };
      }

      paths[path] = { post: op };
    }
  }

  const swagger: SourceSwagger = {
    openapi: "3.0.3",
    info: {
      title: "GraphQL API",
      version: "1.0.0",
      description: `GraphQL schema with ${queryType?.fields?.length ?? 0} queries and ${mutationType?.fields?.length ?? 0} mutations.`,
    },
    servers: baseUrl ? [{ url: baseUrl }] : undefined,
    paths,
    components: {},
    tags: [...tags].sort().map((name) => ({ name })),
  };

  return {
    swagger,
    baseUrl,
    sourceFormat: "graphql",
    sourceLabel: "GraphQL Schema",
  };
}

export const graphqlParser: Parser = {
  format: "graphql",
  label: "GraphQL Schema",

  async parse(input: ParseInput): Promise<ParsedSource> {
    let raw: GQLSchema;
    let baseUrl = "";

    if (input.url) {
      baseUrl = new URL(input.url).origin;
      // Try introspection query
      const r = await fetch(input.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{__schema{queryType{name}mutationType{name}subscriptionType{name}types{kind name description fields(includeDeprecated:true){name description args{name description type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}defaultValue}type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}inputFields{name description type{kind name ofType{kind name ofType{kind name}}}defaultValue}enumValues(includeDeprecated:true){name description}}}}`,
        }),
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} running introspection on ${input.url}`);
      raw = (await r.json()) as GQLSchema;
    } else if (input.json) {
      raw = input.json as GQLSchema;
    } else if (input.text) {
      raw = JSON.parse(input.text) as GQLSchema;
    } else {
      throw new Error("GraphQL parser requires a URL, JSON, or text input.");
    }

    const schema = raw.data?.__schema ?? raw.__schema;
    if (!schema) throw new Error("Invalid GraphQL introspection: no __schema found.");

    return convert(schema, baseUrl);
  },
};
