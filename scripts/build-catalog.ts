/**
 * scripts/build-catalog.ts
 * Reads lib/catalog/swagger-source.json, normalizes lightly, writes
 * lib/catalog/catalog.json. The catalog is what gets imported at runtime.
 *
 * Normalization in v1:
 *   - Ensure top-level `paths` exists.
 *   - Ensure `components` exists.
 * That's it — heavier normalization happens in the slicer.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "lib", "catalog", "swagger-source.json");
const OUT = path.join(process.cwd(), "lib", "catalog", "catalog.json");

async function main() {
  console.log(`[build-catalog] Reading ${SRC}`);
  const raw = await fs.readFile(SRC, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;

  data.paths ??= {};
  data.components ??= {};

  await fs.writeFile(OUT, JSON.stringify(data, null, 2));
  const stat = await fs.stat(OUT);
  console.log(`[build-catalog] Wrote ${OUT} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
