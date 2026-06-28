import type { SessionStats, Badge } from "../parser/types.ts";
import { toRealWorld } from "../parser/pricing.ts";
import { fmtInt, fmtCost, fmtDuration, fmtTokens, fmtHour } from "./format.ts";

// Compact, share-safe stats stored on a post (no prompt/code text).
export interface PostStats {
  costUsd: number;
  savedUsd: number;        // $ saved by cache reads (vs fresh-input billing)
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;     // input + output + cacheRead + cacheWrite (kept for cache-ratio math)
  paidTokens: number;      // input + output + cacheWrite (the cost-driving total)
  cacheReadTokens: number;
  subagents: number;
  durationMs: number;
  filesEdited: number;
  editCallCount: number;
  bashCommands: number;
  totalToolCalls: number;
  dominantTool: string | null;
  rageScore: number;
  interruptions: number;
  clears: number;
  cacheHitRatio: number;
  cacheSaveRate: number;
  userPrompts: number;
  peakHour: number;
  isNightOwl: boolean;
  primaryModel: string | null;
}

// Provenance for the score/review so the card can show what produced it.
export interface PostScoring {
  source: "llm" | "fallback";
  model: string;       // e.g. "claude-haiku-4-5", or "deterministic" for the fallback
  promptSent: string;  // exact stats text sent to the LLM
}

export interface Comment {
  id: string;
  handle: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface Profile {
  handle: string;
  name?: string;
  avatar: string;
  autoShareMinTokens: number;
}

export interface Post {
  id: string;
  handle: string;
  avatar: string; // emoji
  project: string;
  title: string;
  sessionId: string;
  score: number; // 0-10
  review: string; // one-line roast/review
  scoring?: PostScoring; // how the score/review was produced (LLM model + raw prompt)
  statlines: string[]; // punchy stat-format callouts
  stats: PostStats;
  badges: Badge[];
  isDraft: boolean;
  createdAt: string;     // session truth — when the session actually ended
  postedAt?: string;     // server stamp — when the post hit the feed
  publishedAt?: string;  // server stamp — when a draft was published (if applicable)
  reactions: Record<string, number>;
  comments?: Comment[];
}

export function toPostStats(s: SessionStats): PostStats {
  return {
    costUsd: s.costUsd,
    savedUsd: s.savedUsd,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    totalTokens: s.totalTokens,
    paidTokens: s.paidTokens,
    cacheReadTokens: s.cacheReadTokens,
    subagents: s.subagents,
    durationMs: s.durationMs,
    filesEdited: s.filesEdited,
    editCallCount: s.editCallCount,
    bashCommands: s.bashCommands,
    totalToolCalls: s.totalToolCalls,
    dominantTool: s.dominantTool,
    rageScore: s.rageScore,
    interruptions: s.interruptions,
    clears: s.clears,
    cacheHitRatio: s.cacheHitRatio,
    cacheSaveRate: s.cacheSaveRate,
    userPrompts: s.userPrompts,
    peakHour: s.peakHour,
    isNightOwl: s.isNightOwl,
    primaryModel: s.primaryModel,
  };
}

// Punchy, stat-formatted callouts in the style the user asked for:
//   "🔥 burned 23,948,203 tokens with 3 subagents"
//   "💸 $3k — that's 2,000 Big Macs"
//   "😤 rage-quit 7×"
// Returns a prioritized list; the card shows the top few.
export function buildStatlines(s: SessionStats): string[] {
  const rw = toRealWorld(s.costUsd);
  const lines: { line: string; weight: number }[] = [];

  const headline =
    s.subagents > 0
      ? `🔥 ${fmtInt(s.outputTokens)} output tokens with ${s.subagents} subagent${s.subagents === 1 ? "" : "s"}`
      : `🔥 ${fmtInt(s.outputTokens)} output tokens`;
  lines.push({ line: headline, weight: 100 });

  if (s.costUsd >= 0.01) {
    const macs = rw.bigMacs;
    const macStr = macs >= 1 ? `${fmtInt(macs)} Big Mac${Math.round(macs) === 1 ? "" : "s"}` : `${(macs).toFixed(2)} of a Big Mac`;
    lines.push({ line: `💸 ${fmtCost(s.costUsd)} — that's ${macStr}`, weight: 95 });
  }

  if (s.interruptions > 0) {
    lines.push({ line: `😤 rage-quit ${s.interruptions}×`, weight: 90 });
  }
  if (s.subagents >= 3) {
    lines.push({ line: `🤖 commanded ${s.subagents} subagents`, weight: 70 });
  }
  if (s.isNightOwl) {
    lines.push({ line: `🦉 peak grind at ${fmtHour(s.peakHour)}`, weight: 65 });
  }
  if (s.cacheSaveRate >= 0.5) {
    lines.push({ line: `🧊 ${Math.round(s.cacheSaveRate * 100)}% of cost saved by cache`, weight: 50 });
  }
  if (s.durationMs > 0) {
    lines.push({ line: `⏱️ ${fmtDuration(s.durationMs)} of active coding`, weight: 45 });
  }
  if (s.filesEdited > 0) {
    lines.push({ line: `✏️ edited ${s.filesEdited} file${s.filesEdited === 1 ? "" : "s"}`, weight: 40 });
  }
  if (s.bashCommands > 0) {
    lines.push({ line: `🔧 ran ${s.bashCommands} shell command${s.bashCommands === 1 ? "" : "s"}`, weight: 35 });
  }
  if (s.userPrompts > 0) {
    lines.push({ line: `💬 ${s.userPrompts} prompts sent`, weight: 25 });
  }
  if (s.pleaseCount + s.thanksCount >= 3) {
    lines.push({ line: `🙏 was polite ${s.pleaseCount + s.thanksCount}× (to a robot)`, weight: 20 });
  }
  if (s.mostUsedWord) {
    lines.push({ line: `🗣️ most-said word: "${s.mostUsedWord}"`, weight: 15 });
  }

  return lines.sort((a, b) => b.weight - a.weight).map((l) => l.line);
}

let counter = 0;
function genId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildPost(args: {
  handle: string;
  avatar: string;
  stats: SessionStats;
  badges: Badge[];
  score: number;
  review: string;
  scoring?: PostScoring;
  isDraft: boolean;
}): Post {
  return {
    id: genId(),
    handle: args.handle,
    avatar: args.avatar,
    project: args.stats.project,
    title: args.stats.title,
    sessionId: args.stats.sessionId,
    score: args.score,
    review: args.review,
    scoring: args.scoring,
    statlines: buildStatlines(args.stats),
    stats: toPostStats(args.stats),
    badges: args.badges,
    isDraft: args.isDraft,
    // The session's truth — when it actually ended. Server must not overwrite this.
    createdAt: args.stats.endTime ?? new Date().toISOString(),
    reactions: {},
    comments: [],
  };
}
