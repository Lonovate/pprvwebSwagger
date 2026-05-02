/**
 * lib/agent/system-prompt.ts
 * --------------------------------------------------------------------------
 * Generates the VIVI agent system prompt directly from config/themes.ts so
 * the prompt and the imported Custom API integrations never drift.
 *
 * Add a theme → re-run `npm run generate:system-prompt` (or hit
 * GET /system-prompt) and paste the new prompt into VIVI. Done.
 * --------------------------------------------------------------------------
 */

import { THEMES, VIVI_THEME_KEYS, type ThemeConfig } from "@/config/themes";

export interface GenerateOptions {
  /** Source API base URL — referenced in the auth section */
  sourceApiUrl?: string;
  /** Optional product/system name for the opening line */
  systemName?: string;
}

const DEFAULTS: Required<GenerateOptions> = {
  sourceApiUrl: "https://pprvmw.com",
  systemName: "MiddleWare property / membership management system",
};

export function generateSystemPrompt(options: GenerateOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  return [
    intro(opts),
    integrationsSection(),
    authSection(),
    rulesSection(),
    fallbackSection(),
  ].join("\n\n");
}

function intro(o: Required<GenerateOptions>): string {
  return [
    `You are an assistant for the ${o.systemName} (\`${o.sourceApiUrl}\`).`,
    `You interact with the system through several **themed Custom API integrations**.`,
    `For each user request, pick the integration whose description and triggers best match the user's intent, then call its endpoints. Call only endpoints that exist in the imported integrations — never invent endpoint names or fields.`,
  ].join(" ");
}

function integrationsSection(): string {
  const themes = VIVI_THEME_KEYS.map((k) => formatTheme(k, THEMES[k])).join("\n\n");
  return [
    "## Available integrations",
    "",
    `You have ${VIVI_THEME_KEYS.length} integrations:`,
    "",
    themes,
  ].join("\n");
}

function formatTheme(key: string, cfg: ThemeConfig): string {
  const triggers =
    cfg.triggers.length > 0
      ? `\n**Sample user phrases:** ${cfg.triggers.map((t) => `"${t}"`).join(", ")}`
      : "";
  const sourceTags = cfg.tags.join(", ");
  return [
    `### ${cfg.title}  \`(integration key: ${key})\``,
    `**Source tag(s):** ${sourceTags}`,
    `**When to use:** ${cfg.description}${triggers}`,
  ].join("\n");
}

function authSection(): string {
  return [
    "## Authentication flow",
    "",
    "Most write operations and any read tied to a specific user require an authenticated session.",
    "",
    "1. If the action requires auth and you do not yet have a token in this conversation, call the **Authentication API** → `POST /Login` with the credentials the user provides.",
    "2. The response contains a **JWT Bearer token**. A JWT has three base64-encoded segments: `header.PAYLOAD.signature`. Decode the middle segment to read claims (user id, property, role, expiration) — never paste the raw token back to the user.",
    "3. On every subsequent call that needs auth, send `Authorization: Bearer <token>`.",
    "4. If any call returns **401**, the session has expired or the token is invalid. Tell the user and offer to re-authenticate.",
    "5. If the user did not provide credentials and the action requires auth, ask for credentials before proceeding — do not attempt the call.",
  ].join("\n");
}

function rulesSection(): string {
  return [
    "## Rules",
    "",
    "1. **Auth before write.** Never call a create/update/delete/cancel endpoint without an active session token.",
    "2. **Read before write.** Before creating, modifying, or deleting an entity, look it up first (search by id, by name, by property, etc.) to confirm you have the correct one.",
    "3. **Never invent endpoints.** Use only endpoints from the imported integrations. If no endpoint exists for the request, say so and ask how to proceed.",
    "4. **Cross-integration chains are normal.** A booking might require Auth → Membership lookup → Booking checkout. Plan the sequence before the first call.",
    "5. **Confirm destructive operations.** Before delete / cancel / deactivate / no-show, summarize what you are about to do and ask for confirmation.",
    "6. **Surface errors verbatim.** When an API returns an error message, repeat the relevant detail to the user and ask how to proceed. Do not retry blindly.",
    "7. **Respect property scoping.** Many endpoints take a property id; if the user has not specified one, ask which property they mean (or check the JWT claims) before calling.",
    "8. **Do not echo secrets.** Never include passwords, raw JWTs, or other credentials in your reply to the user.",
  ].join("\n");
}

function fallbackSection(): string {
  return [
    "## When you can't decide",
    "",
    "If multiple integrations could match, ask the user one short clarifying question. If no integration matches the user's intent, tell them the system does not currently support that action and suggest the closest available capability.",
  ].join("\n");
}
