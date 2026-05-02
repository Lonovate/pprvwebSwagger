/**
 * lib/env.ts
 * Zod-validated env vars. Lazy — only validates when getEnv() is called so
 * tests / scripts that don't need env don't fail on import.
 */

import { z } from "zod";

const schema = z.object({
  SOURCE_API_URL: z
    .string()
    .url()
    .default("https://pprvmw.com"),
  SWAGGER_URL: z
    .string()
    .url()
    .default("https://pprvmw.com/swagger/v1/swagger.json"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = schema.parse({
    SOURCE_API_URL: process.env.SOURCE_API_URL,
    SWAGGER_URL: process.env.SWAGGER_URL,
  });
  return cached;
}
