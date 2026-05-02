/**
 * scripts/verify-themes.ts
 * Fetches the live swagger, derives themes, slices each one, prints stats.
 */

import { buildThemedSchema } from "../lib/openapi/slice";
import { deriveThemes } from "../lib/themes/registry";
import { DEFAULT_SWAGGER_URL } from "../lib/catalog/runtime";
import type { SourceSwagger } from "../lib/catalog/types";

async function main() {
  const url = process.env.SWAGGER_URL || DEFAULT_SWAGGER_URL;
  console.log(`Fetching ${url} ...`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const swagger = (await r.json()) as SourceSwagger;
  const themes = deriveThemes(swagger);

  let totalOps = 0;
  console.log(
    "key".padEnd(16) +
      "ops".padStart(5) +
      "  schemas".padStart(10) +
      "  hasBearer".padStart(11) +
      "  hasOpIds  hasServers  visible",
  );
  console.log("-".repeat(80));

  for (const t of Object.values(themes)) {
    const slice = buildThemedSchema(t.key, swagger, themes);
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
      t.key.padEnd(16) +
        String(ops.length).padStart(5) +
        String(schemaCount).padStart(10) +
        "  " +
        (hasBearer ? "yes" : "NO ").padStart(9) +
        "  " +
        (allHaveOpIds ? "yes" : "NO ").padStart(7) +
        "   " +
        (hasServers ? "yes" : "NO ").padStart(3) +
        "       " +
        (t.exposeToVivi ? "yes" : "no"),
    );
  }
  console.log("-".repeat(80));
  console.log(
    `Themes: ${Object.keys(themes).length} (visible: ${
      Object.values(themes).filter((t) => t.exposeToVivi).length
    })`,
  );
  console.log(`Total ops across all themes: ${totalOps}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
