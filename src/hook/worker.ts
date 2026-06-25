// Detached background worker: parse a finished session, score it, and post it.
// Spawned by hook.ts so the user's Claude Code shutdown is never blocked.
//   node worker.ts <transcriptPath> <reason>
import { writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { parseSession } from "../parser/parseSession.ts";
import { computeBadges } from "../parser/achievements.ts";
import { generateScore } from "../scoring/score.ts";
import { buildPost } from "../shared/post.ts";
import { readConfig } from "./config.ts";
import { wasRecentlyPosted, markPosted } from "./postedGuard.ts";
import { DATA_DIR, OUTBOX_DIR, ensureDirs } from "../shared/paths.ts";

const LOG = join(DATA_DIR, "worker.log");

function log(msg: string): void {
  try {
    appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* ignore */
  }
}

async function main() {
  const transcriptPath = process.argv[2];
  const reason = process.argv[3] ?? "other";
  if (!transcriptPath) {
    log("no transcript path; exiting");
    return;
  }
  ensureDirs();

  let stats;
  try {
    stats = parseSession(transcriptPath);
  } catch (e) {
    log(`parse failed: ${(e as Error).message}`);
    return;
  }

  // Don't post empty / trivial throwaway sessions.
  if (stats.assistantMessages === 0 || stats.totalTokens === 0) {
    log(`skip empty session ${stats.sessionId}`);
    return;
  }
  if (wasRecentlyPosted(stats.sessionId)) {
    log(`skip duplicate session ${stats.sessionId}`);
    return;
  }

  stats.endReason = reason;
  const cfg = readConfig();
  const badges = computeBadges(stats);
  const score = await generateScore(stats, badges);
  const isDraft = stats.totalTokens < cfg.autoShareMinTokens;

  const post = buildPost({
    handle: cfg.handle,
    avatar: cfg.avatar,
    stats,
    badges,
    score: score.score,
    review: score.review,
    isDraft,
  });

  // Mark before network so a flaky post never double-fires on retry.
  markPosted(stats.sessionId);

  try {
    const res = await fetch(`${cfg.backendUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(post),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    log(`posted ${stats.sessionId} score=${score.score} (${score.source})${isDraft ? " [draft]" : ""}`);
  } catch (e) {
    // Backend offline → queue to outbox; server drains it on next boot.
    const file = join(OUTBOX_DIR, `${post.id}.json`);
    try {
      writeFileSync(file, JSON.stringify(post));
      log(`queued ${stats.sessionId} to outbox (${(e as Error).message})`);
    } catch (e2) {
      log(`failed to queue: ${(e2 as Error).message}`);
    }
  }
}

main().catch((e) => log(`worker crashed: ${(e as Error).message}`));
