// Detached background worker: parse a finished session, score it, and post it.
// Spawned by hook.ts so the user's Claude Code shutdown is never blocked.
//   node worker.ts <transcriptPath> <reason>
//
// Every step is logged to ~/.promptly/worker.log. `npm run serve` tails that file
// to its own stdout so you can watch each session get interpreted in real time.
import { writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { parseSession } from "../parser/parseSession.ts";
import { computeBadges } from "../parser/achievements.ts";
import { generateScore } from "../scoring/score.ts";
import { buildPost } from "../shared/post.ts";
import { readConfig } from "./config.ts";
import { getWatermark, setWatermark } from "./watermarks.ts";
import { DATA_DIR, OUTBOX_DIR, ensureDirs } from "../shared/paths.ts";
import { fmtCost, fmtDuration, fmtInt } from "../shared/format.ts";

const LOG = join(DATA_DIR, "worker.log");

function write(line: string): void {
  try {
    appendFileSync(LOG, line + "\n");
  } catch {
    /* ignore */
  }
}

function log(msg: string): void {
  write(`[${new Date().toISOString()}] ${msg}`);
}

function logBlock(title: string, lines: string[]): void {
  const stamp = new Date().toISOString();
  write(`\n╭─ ${stamp} ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
  for (const l of lines) write(`│ ${l}`);
  write(`╰${"─".repeat(80)}`);
}

async function main() {
  const transcriptPath = process.argv[2];
  const reason = process.argv[3] ?? "other";
  if (!transcriptPath) {
    log("no transcript path; exiting");
    return;
  }
  ensureDirs();

  log(`session ended (reason: ${reason}); parsing ${transcriptPath}`);

  // First pass: identity-only — we need sessionId to look up the watermark, and the
  // file's overall endTime to detect "no new activity" cheaply.
  let identity;
  try {
    identity = parseSession(transcriptPath);
  } catch (e) {
    log(`parse failed: ${(e as Error).message}`);
    return;
  }

  if (identity.assistantMessages === 0 || identity.totalTokens === 0) {
    log(`skip empty session ${identity.sessionId} (no assistant messages or zero tokens)`);
    return;
  }
  // Self-scoring loop defense (secondary; primary is PROMPTLY_SCORING env in hook.ts).
  if (
    identity.userPrompts === 1 &&
    (identity.firstPrompt?.startsWith("Rate this session. Stats:") ||
      identity.title.startsWith("Rate this session."))
  ) {
    log(`skip self-scoring transcript ${identity.sessionId}`);
    return;
  }

  // Watermark: only aggregate work done since the previous /exit on this same session.
  // Claude Code transcripts are append-only across resumes, so without this each post
  // would re-include all prior work on the same sessionId.
  const watermark = getWatermark(identity.sessionId);
  if (watermark && identity.endTime && Date.parse(identity.endTime) <= Date.parse(watermark)) {
    log(`no new activity for ${identity.sessionId} since last post (watermark ${watermark})`);
    return;
  }

  let stats = identity;
  if (watermark) {
    stats = parseSession(transcriptPath, { since: Date.parse(watermark) });
    if (stats.totalTokens === 0 || stats.assistantMessages === 0) {
      log(`empty delta for ${identity.sessionId} since ${watermark}; nothing to post`);
      return;
    }
  }

  stats.endReason = reason;
  const cfg = readConfig();
  const badges = computeBadges(stats);

  const sliceDescription = watermark
    ? `since ${watermark}  (delta — this post only covers work after the last /exit)`
    : `full session  (first /exit on this sessionId)`;

  // Verbose pre-score dump: this is the full "session truth" the parser extracted.
  logBlock("PARSED SESSION", [
    `session:       ${stats.sessionId}`,
    `slice:         ${sliceDescription}`,
    `project:       ${stats.project}  (branch: ${stats.gitBranch ?? "—"})`,
    `title:         ${stats.title}`,
    `model:         ${stats.primaryModel ?? "unknown"}  (all: ${stats.models.join(", ") || "none"})`,
    `start → end:   ${stats.startTime ?? "?"} → ${stats.endTime ?? "?"}`,
    `active dur:    ${fmtDuration(stats.durationMs)}  (peak hour ${stats.peakHour}:00, night-owl: ${stats.isNightOwl})`,
    `output:        ${fmtInt(stats.outputTokens)}  (the headline — what Claude generated)`,
    `input (fresh): ${fmtInt(stats.inputTokens)}`,
    `  cache write: ${fmtInt(stats.cacheWrite5mTokens + stats.cacheWrite1hTokens)}  (5m: ${fmtInt(stats.cacheWrite5mTokens)}, 1h: ${fmtInt(stats.cacheWrite1hTokens)})`,
    `  cache read:  ${fmtInt(stats.cacheReadTokens)}  (free, billed at the cheap cache-read rate)`,
    `  cache ratio: ${(stats.cacheHitRatio * 100).toFixed(0)}%`,
    `cost:          ${fmtCost(stats.costUsd)}`,
    `  breakdown:   input ${fmtCost(stats.costBreakdown.input)} · output ${fmtCost(stats.costBreakdown.output)} · cacheRead ${fmtCost(stats.costBreakdown.cacheRead)} · cacheWrite5m ${fmtCost(stats.costBreakdown.cacheWrite5m)} · cacheWrite1h ${fmtCost(stats.costBreakdown.cacheWrite1h)}`,
    `tools:         ${stats.totalToolCalls} total  (dominant: ${stats.dominantTool ?? "—"})`,
    `  by name:     ${JSON.stringify(stats.toolCounts)}`,
    `subagents:     ${stats.subagents}  (Task calls)`,
    `files edited:  ${stats.filesEdited} unique  (${stats.editCallCount} edit calls)`,
    `bash:          ${stats.bashCommands}`,
    `prompts:       ${stats.userPrompts} sent, avg ${stats.avgPromptLen} chars`,
    `slash cmds:    ${stats.slashCommands.join(", ") || "none"}`,
    `rage:          score ${stats.rageScore}  (interruptions ${stats.interruptions}, clears ${stats.clears}, angry ${stats.angryPrompts}, comeback: ${stats.comeback})`,
    `manners:       please ${stats.pleaseCount}, thanks ${stats.thanksCount}`,
    `most-used wd:  ${stats.mostUsedWord ?? "—"}`,
    `badges:        ${badges.map((b) => `${b.emoji} ${b.label}`).join("  ") || "none"}`,
  ]);

  log(`asking claude -p for score+roast (model: claude-haiku-4-5, 25s timeout)…`);
  const score = await generateScore(stats, badges);

  logBlock("SCORING (the only LLM step)", [
    `source:        ${score.source}  (${score.model})`,
    `score:         ${score.score} / 10`,
    `review:        ${score.review}`,
    "",
    "exact prompt sent to claude -p (stats only — no code, no prompts):",
    ...score.promptSent.split("\n").map((l) => "    " + l),
  ]);

  const isDraft = stats.outputTokens < cfg.autoShareMinTokens;
  const post = buildPost({
    handle: cfg.handle,
    avatar: cfg.avatar,
    stats,
    badges,
    score: score.score,
    review: score.review,
    scoring: { source: score.source, model: score.model, promptSent: score.promptSent },
    isDraft,
  });

  logBlock("BUILT POST", [
    `id:            ${post.id}`,
    `handle:        ${post.handle}`,
    `createdAt:     ${post.createdAt}  (= session endTime, never overwritten)`,
    `isDraft:       ${isDraft}  (threshold: ${fmtInt(cfg.autoShareMinTokens)} output tokens, session: ${fmtInt(stats.outputTokens)} output)`,
    `statlines:`,
    ...post.statlines.map((l) => "    " + l),
  ]);

  // Advance the watermark BEFORE the network call so a flaky POST never double-fires.
  // The next /exit on this same session will only see work after stats.endTime.
  if (stats.endTime) setWatermark(stats.sessionId, stats.endTime);

  try {
    const res = await fetch(`${cfg.backendUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(post),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    log(`✓ POSTed ${stats.sessionId} → ${cfg.backendUrl}/api/posts  (HTTP ${res.status})${isDraft ? "  [draft]" : ""}`);
  } catch (e) {
    const file = join(OUTBOX_DIR, `${post.id}.json`);
    try {
      writeFileSync(file, JSON.stringify(post));
      log(`⚠ backend offline — queued to outbox: ${file}  (${(e as Error).message})`);
    } catch (e2) {
      log(`✗ failed to queue: ${(e2 as Error).message}`);
    }
  }
}

main().catch((e) => log(`worker crashed: ${(e as Error).message}`));
