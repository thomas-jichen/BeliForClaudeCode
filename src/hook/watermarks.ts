// Per-session watermark: ISO end-time of the last slice we've already posted for a
// given Claude Code sessionId. The worker uses this to make each `/exit` post a delta
// of only the work since the previous `/exit` on the same session (Claude Code transcripts
// are append-only across resumes, so without this each post would re-include all prior
// work). Replaces the old posted.json dedup guard.
import { readFileSync, writeFileSync } from "node:fs";
import { WATERMARK_FILE, ensureDirs } from "../shared/paths.ts";

function read(): Record<string, string> {
  try {
    const o = JSON.parse(readFileSync(WATERMARK_FILE, "utf8"));
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

export function getWatermark(sessionId: string): string | null {
  if (!sessionId) return null;
  return read()[sessionId] ?? null;
}

export function setWatermark(sessionId: string, isoEndTime: string): void {
  if (!sessionId || !isoEndTime) return;
  ensureDirs();
  const map = read();
  map[sessionId] = isoEndTime;
  try {
    writeFileSync(WATERMARK_FILE, JSON.stringify(map, null, 2));
  } catch {
    /* ignore */
  }
}
