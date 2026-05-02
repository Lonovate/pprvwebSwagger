/**
 * scripts/fetch-swagger.ts
 * Downloads the source swagger to lib/catalog/swagger-source.json.
 * Run by `npm run prebuild` (and manually any time source schema changes).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const URL_DEFAULT = "https://pprvmw.com/swagger/v1/swagger.json";
const URL = process.env.SWAGGER_URL || URL_DEFAULT;
const OUT = path.join(process.cwd(), "lib", "catalog", "swagger-source.json");

async function main() {
  console.log(`[fetch-swagger] Downloading ${URL}`);
  const r = await fetch(URL);
  if (!r.ok) {
    throw new Error(`[fetch-swagger] HTTP ${r.status} ${r.statusText}`);
  }
  const json = await r.json();
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(json, null, 2));
  const stat = await fs.stat(OUT);
  console.log(`[fetch-swagger] Wrote ${OUT} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
