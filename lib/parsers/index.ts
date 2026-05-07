/**
 * lib/parsers/index.ts
 * --------------------------------------------------------------------------
 * Parser registry. Each parser converts a specific API format into the
 * SourceSwagger shape that all generators already consume.
 *
 *   Input Format → Parser → SourceSwagger → generators → outputs
 * --------------------------------------------------------------------------
 */

import type { SourceSwagger } from "@/lib/catalog/types";

export type SourceFormat = "swagger" | "postman" | "graphql" | "har" | "curl";

export interface ParsedSource {
  swagger: SourceSwagger;
  baseUrl: string;
  sourceFormat: SourceFormat;
  /** Human label e.g. "Postman: My Collection" */
  sourceLabel: string;
}

export interface ParseInput {
  /** Raw JSON object (already parsed) */
  json?: unknown;
  /** Raw text content (cURL commands, or JSON string) */
  text?: string;
  /** URL to fetch from */
  url?: string;
}

export interface Parser {
  format: SourceFormat;
  label: string;
  /** Parse input into the standard SourceSwagger shape. */
  parse(input: ParseInput): Promise<ParsedSource>;
}

// ─── Import parsers ──────────────────────────────────────────────────────────

import { swaggerParser } from "./swagger";
import { postmanParser } from "./postman";
import { graphqlParser } from "./graphql";
import { harParser } from "./har";
import { curlParser } from "./curl";

const PARSERS: Record<SourceFormat, Parser> = {
  swagger: swaggerParser,
  postman: postmanParser,
  graphql: graphqlParser,
  har: harParser,
  curl: curlParser,
};

export function getParser(format: SourceFormat): Parser {
  const parser = PARSERS[format];
  if (!parser) throw new Error(`Unknown format: ${format}`);
  return parser;
}

export function getAllFormats(): { value: SourceFormat; label: string }[] {
  return Object.values(PARSERS).map((p) => ({
    value: p.format,
    label: p.label,
  }));
}
