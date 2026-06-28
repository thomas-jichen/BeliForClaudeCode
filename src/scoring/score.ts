import { spawn } from "node:child_process";
import type { SessionStats, Badge } from "../parser/types.ts";
import { toRealWorld } from "../parser/pricing.ts";
import { fmtCost, fmtDuration, fmtInt, formatModel } from "../shared/format.ts";

export interface Score {
  score: number; // 0-10, one decimal
  review: string; // one-line roast
  source: "llm" | "fallback";
  model: string;       // "claude-haiku-4-5" for LLM, "deterministic" for fallback
  promptSent: string;  // exact stats text sent (for audit / transparency)
}

const SCORING_MODEL = "claude-haiku-4-5";

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n * 10) / 10));
}

// Stats-only summary — deliberately contains NO prompt/code text. The first line names
// the model the caption should be voiced as (the model the developer just worked with).
export function summarize(s: SessionStats, badges: Badge[]): string {
  const rw = toRealWorld(s.costUsd);
  const voiceLabel = formatModel(s.primaryModel) || "Claude";
  return [
    `voiced-as model: ${voiceLabel}`,
    `project: ${s.project}`,
    `title: ${s.title}`,
    `cost: ${fmtCost(s.costUsd)} (${rw.bigMacs.toFixed(1)} Big Macs)`,
    `output tokens: ${fmtInt(s.outputTokens)}`,
    `input tokens (fresh): ${fmtInt(s.inputTokens)}`,
    `cache reads (free): ${fmtInt(s.cacheReadTokens)}`,
    `cache save rate: ${(s.cacheSaveRate * 100).toFixed(0)}% of dollar cost saved by cache`,
    `active duration: ${fmtDuration(s.durationMs)}`,
    `subagents spawned: ${s.subagents}`,
    `files edited: ${s.filesEdited} unique (${s.editCallCount} edit calls), shell commands: ${s.bashCommands}, total tool calls: ${s.totalToolCalls}`,
    `dominant tool: ${s.dominantTool ?? "none"}`,
    `prompts sent: ${s.userPrompts}, avg length: ${s.avgPromptLen} chars`,
    `rage score: ${s.rageScore} (interruptions: ${s.interruptions}, clears: ${s.clears}, angry prompts: ${s.angryPrompts})`,
    `peak hour: ${s.peakHour}:00, night owl: ${s.isNightOwl}`,
    `politeness: please ${s.pleaseCount}, thanks ${s.thanksCount}`,
    `badges: ${badges.map((b) => b.label).join(", ") || "none"}`,
  ].join("\n");
}

// Role/instructions go in the system prompt so the coding-assistant persona doesn't
// resist generating the JSON. The user message carries only stats. The "voiced-as model"
// stat tells the LLM which Claude family's personality to impersonate.
const SYSTEM_PROMPT =
  "You are RoastBot for Promptly, a sanctioned social feature that turns Claude Code coding " +
  "sessions into shareable Beli/Strava-style posts. The user message contains ONLY session " +
  "statistics (no code, no secrets). " +
  "Write the caption in the voice of the 'voiced-as model' named in the stats. That is the " +
  "Claude family the developer just spent the session with. Match its known personality. " +
  "If you do not recognize the model, default to a generic conversational Claude voice. " +
  "The caption has two natural clauses: first what the developer actually did this session " +
  "(grounded in the stats), then a funny roast or observation about it. Both clauses in the " +
  "same voice, joined naturally as one sentence. " +
  "HARD CONSTRAINTS: write the way a person texts, not the way a chatbot does. " +
  "Do NOT use em dashes (—). Do NOT use semicolons. Avoid stilted LLM tells like 'simply', " +
  "'literally', 'just so you know', 'as an AI'. No hashtags. No double quotes inside the " +
  "review string. Total length under 200 characters. Do NOT prefix the review with the " +
  "model name — the UI adds that. " +
  "Reply with a single JSON object and nothing else: " +
  '{"score": <number 0-10 with one decimal, higher = more epic/unhinged/impressive>, ' +
  '"review": "<the two-clause caption>"}.';

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
        "--model", SCORING_MODEL,
        "--permission-mode", "default",
        "--disallowedTools", "Bash Edit Write Read Task WebFetch WebSearch TodoWrite Glob Grep",
        "--append-system-prompt", SYSTEM_PROMPT,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        // PROMPTLY_SCORING is inherited by Claude Code, then by the SessionEnd hook
        // it fires when this `-p` invocation ends — the hook checks this env var and
        // bails immediately, preventing the scorer from scoring its own scoring session.
        env: { ...process.env, PROMPTLY_SCORING: "1" },
      },
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

// Even with explicit "no em dashes" + "do not prefix with the model name" instructions, the
// LLM sometimes does both. Strip defensively so the UI always renders cleanly.
function sanitizeReview(raw: string, voiceLabel: string): string {
  let r = raw.trim();
  // Drop a leading "Opus 4.8:" / "Claude:" / etc that the model added anyway.
  const prefixPatterns = [
    new RegExp("^" + voiceLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s*[:\\-—]\\s*", "i"),
    /^claude\s*[:\-—]\s*/i,
    /^(opus|sonnet|haiku|fable|mythos)\s+\d+(?:\.\d+)?\s*[:\-—]\s*/i,
  ];
  for (const p of prefixPatterns) r = r.replace(p, "");
  // Em dash / en dash / double-hyphen → comma. Keep the rhythm of two clauses.
  r = r.replace(/\s*[—–]\s*/g, ", ");
  r = r.replace(/\s*--\s*/g, ", ");
  // Collapse stray double-quotes the LLM sometimes wraps the value in.
  r = r.replace(/^"+|"+$/g, "").trim();
  return r;
}

export function fallbackScore(s: SessionStats, badges: Badge[], promptSent: string): Score {
  let score = 5;
  score += Math.min(2, s.costUsd / 5);
  score += Math.min(1.5, s.outputTokens / 500_000);
  score += Math.min(1, s.subagents * 0.3);
  score += Math.min(1, s.filesEdited * 0.1);
  score += Math.min(0.5, s.userPrompts * 0.05);
  score -= Math.min(2, s.rageScore * 0.4);

  const rw = toRealWorld(s.costUsd);
  // What the developer actually did (one short conversational clause). Picked from the
  // first stat that has any signal — falls through to a generic "kept it light".
  let didLine: string;
  if (s.subagents >= 3) {
    didLine = `kicked off ${s.subagents} subagents and let them cook`;
  } else if (s.filesEdited >= 5) {
    didLine = `touched ${s.filesEdited} files and called it a session`;
  } else if (s.outputTokens >= 50_000) {
    didLine = `cranked out ${fmtInt(s.outputTokens)} output tokens`;
  } else if (s.bashCommands >= 5) {
    didLine = `ran ${s.bashCommands} shell commands like you owned the place`;
  } else if (s.userPrompts >= 1) {
    didLine = `sent ${s.userPrompts} prompt${s.userPrompts === 1 ? "" : "s"} into the void`;
  } else {
    didLine = `kept things low key today`;
  }
  // The roast clause. Conditioned on the most-loud stat that wasn't already used above.
  let roastLine: string;
  if (s.interruptions >= 3) {
    roastLine = `but really rage-quit ${s.interruptions} times before letting it ship`;
  } else if (s.costUsd >= 5) {
    roastLine = `but really lit ${fmtCost(s.costUsd)} on fire, around ${rw.bigMacs.toFixed(0)} Big Macs gone`;
  } else if (s.isNightOwl) {
    roastLine = `at ${s.peakHour}:00 because sleep is for the unbroken`;
  } else if (s.outputTokens >= 200_000) {
    roastLine = `and the context window is filing a restraining order`;
  } else if (s.cacheSaveRate >= 0.6) {
    roastLine = `and let the cache do ${Math.round(s.cacheSaveRate * 100)}% of the actual paying`;
  } else if (s.pleaseCount + s.thanksCount >= 3) {
    roastLine = `with manners on like you were getting a performance review`;
  } else {
    roastLine = `and behaved suspiciously well throughout`;
  }
  const review = `${didLine} ${roastLine}.`.slice(0, 200);

  return { score: clampScore(score), review, source: "fallback", model: "deterministic", promptSent };
}

export async function generateScore(
  s: SessionStats,
  badges: Badge[],
  opts: { timeoutMs?: number } = {},
): Promise<Score> {
  const promptSent = PROMPT_INTRO + summarize(s, badges);
  const voiceLabel = formatModel(s.primaryModel) || "Claude";
  try {
    const out = await runClaude(promptSent, opts.timeoutMs ?? 25000);
    const parsed = parseJsonLoose(out);
    if (parsed && typeof parsed.score === "number" && typeof parsed.review === "string" && parsed.review.trim()) {
      return {
        score: clampScore(parsed.score),
        review: sanitizeReview(parsed.review, voiceLabel).slice(0, 200),
        source: "llm",
        model: SCORING_MODEL,
        promptSent,
      };
    }
  } catch {
    // fall through to deterministic
  }
  return fallbackScore(s, badges, promptSent);
}
