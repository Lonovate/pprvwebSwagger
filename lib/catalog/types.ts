/**
 * lib/catalog/types.ts
 * Minimal OpenAPI 3.x types — covers what the slicer + registry need.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: Record<string, string[]>[];
  deprecated?: boolean;
  [k: string]: unknown;
}

export type PathItem = Record<string, OperationObject> & {
  parameters?: unknown[];
};

export type ComponentsSection = Record<string, unknown>;

export interface OpenAPIComponents {
  schemas?: ComponentsSection;
  responses?: ComponentsSection;
  parameters?: ComponentsSection;
  examples?: ComponentsSection;
  requestBodies?: ComponentsSection;
  headers?: ComponentsSection;
  securitySchemes?: ComponentsSection;
  links?: ComponentsSection;
  callbacks?: ComponentsSection;
  pathItems?: ComponentsSection;
  [k: string]: ComponentsSection | undefined;
}

export interface SourceSwagger {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, PathItem>;
  components?: OpenAPIComponents;
  security?: Record<string, string[]>[];
  tags?: { name: string; description?: string }[];
  [k: string]: unknown;
}

export interface ThemedSchema {
  openapi: string;
  info: { title: string; description: string; version: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, OperationObject>>;
  components: OpenAPIComponents;
  security?: Record<string, string[]>[];
}
