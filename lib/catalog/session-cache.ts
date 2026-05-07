/**
 * lib/catalog/session-cache.ts
 * In-memory cache for parsed API sources. Each entry is keyed by a random
 * session ID (sid) and expires after 30 minutes. This avoids re-parsing
 * on every download click.
 */

import type { SourceSwagger } from "./types";

export interface CachedEntry {
  swagger: SourceSwagger;
  baseUrl: string;
  sourceFormat: string;
  sourceLabel: string;
  lastFetched: string;
  expiresAt: number;
}

const CACHE = new Map<string, CachedEntry>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of CACHE) {
    if (entry.expiresAt < now) CACHE.delete(key);
  }
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function setCachedSource(
  sid: string,
  data: Omit<CachedEntry, "expiresAt">,
): void {
  cleanup();
  CACHE.set(sid, { ...data, expiresAt: Date.now() + TTL_MS });
}

export function getCachedSource(sid: string): CachedEntry | null {
  const entry = CACHE.get(sid);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    CACHE.delete(sid);
    return null;
  }
  return entry;
}
