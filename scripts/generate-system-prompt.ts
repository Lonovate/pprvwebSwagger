/**
 * scripts/generate-system-prompt.ts
 * Fetches the live swagger, derives themes, generates the system prompt,
 * writes lib/agent/system-prompt.md, and prints the contents.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { generateSystemPrompt } from "../lib/agent/system-prompt";
import { deriveThemes } from "../lib/themes/registry";
import { DEFAULT_SWAGGER_URL } from "../lib/catalog/runtime";
import type { SourceSwagger } from "../lib/catalog/types";

async function main() {
  const url = process.env.SWAGGER_URL || DEFAULT_SWAGGER_URL;
  console.log(`[generate-system-prompt] Fetching ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const swagger = (await r.json()) as SourceSwagger;
  const themes = deriveThemes(swagger);
  const text = generateSystemPrompt(themes);

  const out = path.join(process.cwd(), "lib", "agent", "system-prompt.md");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, text);
  console.log(`[generate-system-prompt] Wrote ${out} (${text.length} chars)`);
  console.log("─".repeat(70));
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
