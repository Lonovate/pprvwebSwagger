/**
 * scripts/inspect-tags.ts
 * Live swagger inspector. Prints + writes a JSON report.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_SWAGGER_URL } from "../lib/catalog/runtime";

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

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

async function main() {
  const url = process.env.SWAGGER_URL || DEFAULT_SWAGGER_URL;
  console.log(`Fetching ${url} ...`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = (await r.json()) as Record<string, unknown>;
  const paths = (data.paths as Record<string, Record<string, unknown>>) ?? {};

  let total = 0;
  const methodsOverall: Record<string, number> = {};
  const byTag: Record<
    string,
    { count: number; methods: Record<string, number>; samplePaths: string[] }
  > = {};
  const untagged: { path: string; method: string }[] = [];

  for (const [p, item] of Object.entries(paths)) {
    if (!isObj(item)) continue;
    for (const [m, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(m.toLowerCase())) continue;
      if (!isObj(op)) continue;
      total++;
      const M = m.toUpperCase();
      methodsOverall[M] = (methodsOverall[M] ?? 0) + 1;
      const tags = (op.tags as string[] | undefined) ?? [];
      if (tags.length === 0) {
        untagged.push({ path: p, method: M });
        continue;
      }
      for (const tag of tags) {
        byTag[tag] ??= { count: 0, methods: {}, samplePaths: [] };
        byTag[tag].count++;
        byTag[tag].methods[M] = (byTag[tag].methods[M] ?? 0) + 1;
        byTag[tag].samplePaths.push(`${M} ${p}`);
      }
    }
  }

  const tagSummary = Object.entries(byTag)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tag, info]) => ({
      tag,
      count: info.count,
      methods: info.methods,
      samplePaths: info.samplePaths.slice(0, 5),
    }));

  const components = (data.components as Record<string, unknown>) ?? {};
  const securitySchemes = (components.securitySchemes as Record<string, unknown>) ?? {};
  const componentSchemas = (components.schemas as Record<string, unknown>) ?? {};
  const info = (data.info as { title?: string; version?: string }) ?? {};

  const report = {
    inspectedAt: new Date().toISOString(),
    swaggerUrl: url,
    swaggerInfo: data.info,
    openapiVersion: data.openapi ?? data.swagger,
    totalEndpoints: total,
    methodsOverall,
    uniqueTagCount: Object.keys(byTag).length,
    tagBreakdown: tagSummary,
    untaggedCount: untagged.length,
    untaggedSample: untagged.slice(0, 20),
    auth: { securitySchemes },
    componentSchemaCount: Object.keys(componentSchemas).length,
  };

  const outDir = path.join(process.cwd(), "lib", "catalog");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "inspect-report.json");
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(`OpenAPI: ${report.openapiVersion}`);
  console.log(`Title: ${info.title} v${info.version}`);
  console.log(`Total endpoints: ${total}`);
  console.log(`Methods: ${JSON.stringify(methodsOverall)}`);
  console.log(`Unique tags: ${report.uniqueTagCount}`);
  console.log(`Untagged ops: ${report.untaggedCount}`);
  console.log(`Auth schemes: ${JSON.stringify(Object.keys(securitySchemes))}`);
  console.log(`Component schemas: ${report.componentSchemaCount}`);
  console.log("");
  console.log("=== TAG BREAKDOWN (sorted by count) ===");
  for (const t of tagSummary) {
    const ms = Object.entries(t.methods)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(`  ${String(t.count).padStart(4)}  ${t.tag}  (${ms})`);
  }
  console.log("");
  console.log(`Report written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
