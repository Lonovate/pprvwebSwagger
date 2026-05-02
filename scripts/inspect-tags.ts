/**
 * scripts/inspect-tags.ts
 * --------------------------------------------------------------------------
 * One-off swagger inspector. Re-run when source swagger changes.
 *
 * Usage:
 *   npx tsx scripts/inspect-tags.ts
 *   npx tsx scripts/inspect-tags.ts --url https://pprvmw.com/swagger/v1/swagger.json
 *
 * Reads the source swagger from lib/catalog/swagger-source.json (or fetches
 * from --url). Writes lib/catalog/inspect-report.json. Prints a compact
 * summary suitable for pasting into CLAUDE.md or chat.
 * --------------------------------------------------------------------------
 */

import { promises as fs } from "node:fs";
import path from "node:path";

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

interface InspectArgs {
  url?: string;
}

function parseArgs(argv: string[]): InspectArgs {
  const args: InspectArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      args.url = argv[++i];
    }
  }
  return args;
}

async function loadSwagger(args: InspectArgs, srcPath: string): Promise<unknown> {
  if (args.url) {
    const r = await fetch(args.url);
    if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
    return r.json();
  }
  const buf = await fs.readFile(srcPath, "utf8");
  return JSON.parse(buf);
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const srcPath = path.join(root, "lib", "catalog", "swagger-source.json");
  const outPath = path.join(root, "lib", "catalog", "inspect-report.json");

  const data = (await loadSwagger(args, srcPath)) as Record<string, unknown>;
  const paths = (data.paths as Record<string, Record<string, unknown>>) ?? {};

  let total = 0;
  const methodsOverall: Record<string, number> = {};
  const byTag: Record<
    string,
    { count: number; methods: Record<string, number>; samplePaths: string[] }
  > = {};
  const untagged: { path: string; method: string; operationId?: string }[] = [];
  const opIds: string[] = [];
  const dupOpIds: string[] = [];
  const seenOpIds = new Set<string>();
  const nonJsonOps: { path: string; method: string; contentTypes: string[] }[] = [];

  for (const [p, item] of Object.entries(paths)) {
    if (!isObj(item)) continue;
    for (const [m, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(m.toLowerCase())) continue;
      if (!isObj(op)) continue;
      total++;
      const M = m.toUpperCase();
      methodsOverall[M] = (methodsOverall[M] ?? 0) + 1;

      const tags = (op.tags as string[] | undefined) ?? [];
      const opId = op.operationId as string | undefined;
      if (opId) {
        if (seenOpIds.has(opId)) dupOpIds.push(opId);
        else seenOpIds.add(opId);
        opIds.push(opId);
      }

      const responses = (op.responses as Record<string, Record<string, unknown>>) ?? {};
      const ctypes = new Set<string>();
      for (const r of Object.values(responses)) {
        const content = (r?.content as Record<string, unknown>) ?? {};
        for (const ct of Object.keys(content)) ctypes.add(ct);
      }
      if (ctypes.size > 0 && ![...ctypes].some((c) => c.includes("json"))) {
        nonJsonOps.push({ path: p, method: M, contentTypes: [...ctypes].sort() });
      }

      if (tags.length === 0) {
        untagged.push({ path: p, method: M, operationId: opId });
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

  const report = {
    swaggerInfo: data.info,
    openapiVersion: data.openapi ?? data.swagger,
    servers: data.servers,
    totalEndpoints: total,
    methodsOverall,
    uniqueTagCount: Object.keys(byTag).length,
    tagBreakdown: tagSummary,
    untaggedCount: untagged.length,
    untaggedSample: untagged.slice(0, 20),
    operationIds: {
      withId: opIds.length,
      missing: total - opIds.length,
      duplicates: dupOpIds.slice(0, 20),
      duplicateCount: dupOpIds.length,
    },
    auth: {
      globalSecurity: data.security,
      securitySchemes,
    },
    nonJsonResponseOps: nonJsonOps.slice(0, 20),
    nonJsonResponseOpsCount: nonJsonOps.length,
    componentSchemaCount: Object.keys(componentSchemas).length,
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  // Human-readable summary
  const info = (data.info as { title?: string; version?: string }) ?? {};
  console.log(`OpenAPI: ${report.openapiVersion}`);
  console.log(`Title: ${info.title} v${info.version}`);
  console.log(`Servers: ${JSON.stringify(report.servers)}`);
  console.log(`Total endpoints: ${total}`);
  console.log(`Methods: ${JSON.stringify(methodsOverall)}`);
  console.log(`Unique tags: ${report.uniqueTagCount}`);
  console.log(`Untagged ops: ${report.untaggedCount}`);
  console.log(
    `OperationIds: ${report.operationIds.withId}/${total} (missing=${report.operationIds.missing}, dupes=${report.operationIds.duplicateCount})`,
  );
  console.log(`Component schemas: ${report.componentSchemaCount}`);
  console.log(`Non-JSON response ops: ${report.nonJsonResponseOpsCount}`);
  console.log(`Auth schemes: ${JSON.stringify(Object.keys(securitySchemes))}`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
