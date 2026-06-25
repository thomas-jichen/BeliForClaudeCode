import { spawn } from "node:child_process";
import type { SessionStats, Badge } from "../parser/types.ts";
import { toRealWorld } from "../parser/pricing.ts";
import { fmtCost, fmtDuration, fmtInt } from "../shared/format.ts";

export interface Score {
  score: number; // 0-10, one decimal
  review: string; // one-line roast
  source: "llm" | "fallback";
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n * 10) / 10));
}

// Stats-only summary — deliberately contains NO prompt/code text.
function summarize(s: SessionStats, badges: Badge[]): string {
  const rw = toRealWorld(s.costUsd);
  return [
    `project: ${s.project}`,
    `title: ${s.title}`,
    `cost: ${fmtCost(s.costUsd)} (${rw.bigMacs.toFixed(1)} Big Macs)`,
    `tokens: ${fmtInt(s.totalTokens)}`,
    `active duration: ${fmtDuration(s.durationMs)}`,
    `subagents spawned: ${s.subagents}`,
    `files edited: ${s.filesEdited}, shell commands: ${s.bashCommands}, total tool calls: ${s.totalToolCalls}`,
    `dominant tool: ${s.dominantTool ?? "none"}`,
    `prompts sent: ${s.userPrompts}, avg length: ${s.avgPromptLen} chars`,
    `rage score: ${s.rageScore} (interruptions: ${s.interruptions}, clears: ${s.clears}, angry prompts: ${s.angryPrompts})`,
    `cache hit ratio: ${(s.cacheHitRatio * 100).toFixed(0)}%`,
    `peak hour: ${s.peakHour}:00, night owl: ${s.isNightOwl}`,
    `politeness: please ${s.pleaseCount}, thanks ${s.thanksCount}`,
    `badges: ${badges.map((b) => b.label).join(", ") || "none"}`,
  ].join("\n");
}

// Role/instructions go in the system prompt so the coding-assistant persona doesn't
// resist generating the JSON. The user message carries only stats.
const SYSTEM_PROMPT =
  "You are RoastBot for Promptly — a sanctioned feature that rates Claude Code coding sessions " +
  "like Beli rates restaurants, so developers can share them like Strava workouts. " +
  "The user message contains ONLY session statistics (no code, no secrets). " +
  "Your ONLY job: reply with a single JSON object and nothing else, in the form " +
  '{"score": <number 0-10 with one decimal, higher = more epic/unhinged/impressive>, ' +
  '"review": "<one witty roast under 90 chars, playful and a little mean, no hashtags, no double-quotes inside>"}.';

const PROMPT_INTRO = "Rate this session. Stats:\n";

// Run headless Claude Code. We override the user's global plan-mode default and disable
// all tools so this is a pure, fast text generation that reuses existing auth (no API key).
function runClaude(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    let done = false;
    const child = spawn(
      "claude",
      [
        "-p",
        "--model", "claude-haiku-4-5",
        "--permission-mode", "default",
        "--disallowedTools", "Bash Edit Write Read Task WebFetch WebSearch TodoWrite Glob Grep",
        "--append-system-prompt", SYSTEM_PROMPT,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill("SIGKILL");
        reject(new Error("claude -p timed out"));
      }
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(e);
      }
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude -p exited ${code}: ${err.slice(0, 200)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function parseJsonLoose(text: string): { score?: number; review?: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function fallbackScore(s: SessionStats, badges: Badge[]): Score {
  let score = 5;
  score += Math.min(2, s.costUsd / 5);
  score += Math.min(1.5, s.totalTokens / 2_000_000);
  score += Math.min(1, s.subagents * 0.3);
  score += Math.min(1, s.filesEdited * 0.1);
  score += Math.min(0.5, s.userPrompts * 0.05);
  score -= Math.min(2, s.rageScore * 0.4);

  const rw = toRealWorld(s.costUsd);
  let review: string;
  if (s.interruptions >= 3) {
    review = `Rage-quit ${s.interruptions}× and lived to post about it. Therapy is cheaper.`;
  } else if (s.subagents >= 5) {
    review = `Spawned ${s.subagents} subagents. Pure middle-management energy.`;
  } else if (s.costUsd >= 5) {
    review = `Torched ${fmtCost(s.costUsd)} — that's ${rw.bigMacs.toFixed(0)} Big Macs in tokens.`;
  } else if (s.totalTokens >= 1_000_000) {
    review = `${fmtInt(s.totalTokens)} tokens gone. The context window never stood a chance.`;
  } else if (s.isNightOwl) {
    review = `Coding at ${s.peakHour}:00. Sleep is for people without bugs.`;
  } else if (s.filesEdited >= 5) {
    review = `Touched ${s.filesEdited} files. Somebody's feeling brave.`;
  } else {
    review = `A tidy little session. Almost suspiciously well-behaved.`;
  }

  return { score: clampScore(score), review, source: "fallback" };
}

export async function generateScore(
  s: SessionStats,
  badges: Badge[],
  opts: { timeoutMs?: number } = {},
): Promise<Score> {
  const prompt = PROMPT_INTRO + summarize(s, badges);
  try {
    const out = await runClaude(prompt, opts.timeoutMs ?? 25000);
    const parsed = parseJsonLoose(out);
    if (parsed && typeof parsed.score === "number" && typeof parsed.review === "string" && parsed.review.trim()) {
      return {
        score: clampScore(parsed.score),
        review: parsed.review.trim().slice(0, 140),
        source: "llm",
      };
    }
  } catch {
    // fall through to deterministic
  }
  return fallbackScore(s, badges);
}
