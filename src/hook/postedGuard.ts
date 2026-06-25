import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, ensureDirs } from "../shared/paths.ts";

const GUARD_FILE = join(DATA_DIR, "posted.json");
const WINDOW_MS = 60 * 60 * 1000; // dedupe a session for 1h (clear→exit fires twice)

function read(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(GUARD_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function wasRecentlyPosted(sessionId: string): boolean {
  if (!sessionId) return false;
  const ts = read()[sessionId];
  return typeof ts === "number" && Date.now() - ts < WINDOW_MS;
}

export function markPosted(sessionId: string): void {
  if (!sessionId) return;
  ensureDirs();
  const map = read();
  map[sessionId] = Date.now();
  // prune old entries
  for (const [k, v] of Object.entries(map)) {
    if (Date.now() - v > WINDOW_MS * 24) delete map[k];
  }
  try {
    writeFileSync(GUARD_FILE, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
