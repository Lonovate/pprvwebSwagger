/**
 * lib/env.ts
 * Zod-validated env vars. Lazy — only validates when getEnv() is called so
 * tests / scripts that don't need env don't fail on import.
 */

import { z } from "zod";

const schema = z.object({
  // Production
  SOURCE_API_URL: z.string().url().default("https://example.com"),
  SWAGGER_URL: z.string().url().default("https://example.com/swagger/v1/swagger.json"),
  // Development
  DEV_API_URL: z.string().url().default("https://example.com"),
  DEV_SWAGGER_URL: z.string().url().default("https://example.com/swagger/v1/swagger.json"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = schema.parse({
    SOURCE_API_URL: process.env.SOURCE_API_URL,
    SWAGGER_URL: process.env.SWAGGER_URL,
    DEV_API_URL: process.env.DEV_API_URL,
    DEV_SWAGGER_URL: process.env.DEV_SWAGGER_URL,
  });
  return cached;
}
