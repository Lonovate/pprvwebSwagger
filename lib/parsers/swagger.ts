/**
 * lib/parsers/swagger.ts
 * Swagger/OpenAPI parser — wraps the existing flow.
 */

import type { SourceSwagger } from "@/lib/catalog/types";
import type { Parser, ParseInput, ParsedSource } from "./index";

function deriveBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export const swaggerParser: Parser = {
  format: "swagger",
  label: "Swagger / OpenAPI",

  async parse(input: ParseInput): Promise<ParsedSource> {
    let swagger: SourceSwagger;
    let sourceUrl = "";

    if (input.url) {
      sourceUrl = input.url;
      const r = await fetch(input.url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${input.url}`);
      swagger = (await r.json()) as SourceSwagger;
    } else if (input.json) {
      swagger = input.json as SourceSwagger;
    } else if (input.text) {
      swagger = JSON.parse(input.text) as SourceSwagger;
    } else {
      throw new Error("Swagger parser requires a URL, JSON, or text input.");
    }

    const base =
      swagger.servers?.[0]?.url ?? (sourceUrl ? deriveBaseUrl(sourceUrl) : "");

    return {
      swagger,
      baseUrl: base,
      sourceFormat: "swagger",
      sourceLabel: `Swagger: ${swagger.info?.title ?? "API"}`,
    };
  },
};
