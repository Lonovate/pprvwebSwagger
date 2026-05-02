/**
 * Quick end-to-end verifier: slices every theme against the real catalog and
 * prints stats. Use to sanity-check after major changes.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { THEMES } from "../config/themes";
import { buildThemedSchema } from "../lib/openapi/slice";
import type { SourceSwagger } from "../lib/catalog/types";

async function main() {
  const cat = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "lib", "catalog", "catalog.json"),
      "utf8",
    ),
  ) as SourceSwagger;

  let totalOps = 0;
  console.log(
    "key".padEnd(16) +
      "ops".padStart(5) +
      "  schemas".padStart(10) +
      "  hasBearer".padStart(11) +
      "  hasOpIds  hasServers",
  );
  console.log("-".repeat(70));

  for (const key of Object.keys(THEMES)) {
    const slice = buildThemedSchema(key, cat);
    const ops = Object.values(slice.paths).flatMap((p) =>
      Object.entries(p).filter(([m]) =>
        ["get", "post", "put", "patch", "delete"].includes(m.toLowerCase()),
      ),
    );
    totalOps += ops.length;
    const schemaCount = Object.keys(
      (slice.components.schemas ?? {}) as Record<string, unknown>,
    ).length;
    const hasBearer = !!(slice.components.securitySchemes as Record<string, unknown>)
      ?.Bearer;
    const allHaveOpIds = ops.every(([, op]) => !!(op as { operationId?: string }).operationId);
    const hasServers =
      Array.isArray(slice.servers) &&
      slice.servers.length > 0 &&
      slice.servers[0].url === "https://pprvmw.com";

    console.log(
      key.padEnd(16) +
        String(ops.length).padStart(5) +
        String(schemaCount).padStart(10) +
        "  " +
        (hasBearer ? "yes" : "NO ").padStart(9) +
        "  " +
        (allHaveOpIds ? "yes" : "NO ").padStart(7) +
        "   " +
        (hasServers ? "yes" : "NO"),
    );
  }
  console.log("-".repeat(70));
  console.log(`Total ops across all themes: ${totalOps}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
