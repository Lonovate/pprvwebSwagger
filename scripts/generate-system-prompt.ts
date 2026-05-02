/**
 * scripts/generate-system-prompt.ts
 * Writes the latest VIVI system prompt to lib/agent/system-prompt.md
 * and prints it to stdout.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { generateSystemPrompt } from "../lib/agent/system-prompt";

async function main() {
  const text = generateSystemPrompt();
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
