import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { SessionStats, ToolCounts } from "./types.ts";
import { costForUsage, costBreakdown as costBuckets, costSavedByCache } from "./pricing.ts";
import { detectRage } from "./rage.ts";

const STOPWORDS = new Set([
  "the", "and", "for", "you", "this", "that", "with", "have", "are", "was", "but",
  "not", "can", "use", "all", "any", "from", "your", "its", "out", "now", "get",
  "should", "would", "could", "make", "made", "want", "need", "like", "just", "also",
  "into", "then", "than", "when", "what", "why", "how", "add", "set", "lets", "let",
  "okay", "yes", "please", "thanks", "thank", "still", "more", "one", "two", "see",
  "file", "code", "line", "page", "https", "http", "www", "com",
]);

interface RawLine {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  aiTitle?: string;
  message?: any;
}

function extractUserText(content: unknown): { text: string; toolResultOnly: boolean } {
  if (typeof content === "string") return { text: content, toolResultOnly: false };
  if (!Array.isArray(content)) return { text: "", toolResultOnly: false };
  let text = "";
  let sawText = false;
  let sawToolResult = false;
  for (const block of content) {
    if (block && typeof block === "object") {
      if (block.type === "text" && typeof block.text === "string") {
        text += block.text + " ";
        sawText = true;
      } else if (block.type === "tool_result") {
        sawToolResult = true;
      }
    }
  }
  return { text: text.trim(), toolResultOnly: sawToolResult && !sawText };
}

export interface ParseOptions {
  // If provided, aggregate only messages whose timestamp is strictly later than this
  // epoch ms. Identity fields (sessionId, cwd, gitBranch, aiTitle) are still read from
  // the entire file. Used by the worker to make each /exit a delta since the previous
  // /exit on the same session.
  since?: number;
}

export function parseSession(transcriptPath: string, options: ParseOptions = {}): SessionStats {
  const raw = readFileSync(transcriptPath, "utf8");
  const lines = raw.split("\n");
  const since = options.since ?? -Infinity;

  let sessionId = "";
  let cwd = "";
  let gitBranch: string | undefined;
  let aiTitle = "";
  let firstPrompt = "";

  const models = new Map<string, number>();
  let inputTokens = 0,
    outputTokens = 0,
    cacheReadTokens = 0,
    cacheWrite5m = 0,
    cacheWrite1h = 0;
  let costUsd = 0;
  let savedUsd = 0;
  const costBreakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };

  const toolCounts: ToolCounts = {};
  const editedFiles = new Set<string>();
  let assistantMessages = 0;

  const tsList: number[] = [];
  const hourHist = new Array(24).fill(0);

  const promptTexts: string[] = [];
  const slashCommands = new Set<string>();
  let clears = 0;
  let interruptions = 0;
  let pleaseCount = 0;
  let thanksCount = 0;
  const wordFreq = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let o: RawLine;
    try {
      o = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Identity fields are always read — they describe the whole session, not a slice.
    if (o.sessionId && !sessionId) sessionId = o.sessionId;
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.gitBranch && !gitBranch) gitBranch = o.gitBranch;
    if (o.aiTitle) aiTitle = o.aiTitle;

    // Watermark gate: when `since` is set, skip aggregation for anything not strictly
    // newer. Lines without a timestamp are skipped from aggregation when filtering, since
    // we can't place them in time (these are mostly meta/permission events that contribute
    // nothing anyway).
    const t = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (since !== -Infinity && (Number.isNaN(t) || t <= since)) continue;

    if (!Number.isNaN(t)) {
      tsList.push(t);
      hourHist[new Date(t).getHours()]++;
    }

    if (o.type === "assistant" && o.message) {
      assistantMessages++;
      const model: string | undefined = o.message.model;
      const isSynthetic = !model || model === "<synthetic>";
      if (model && !isSynthetic) models.set(model, (models.get(model) ?? 0) + 1);

      const u = isSynthetic ? null : o.message.usage;
      if (u) {
        const i = u.input_tokens ?? 0;
        const out = u.output_tokens ?? 0;
        const cr = u.cache_read_input_tokens ?? 0;
        const c5 = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
        const c1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
        inputTokens += i;
        outputTokens += out;
        cacheReadTokens += cr;
        cacheWrite5m += c5;
        cacheWrite1h += c1;
        const usage = { input: i, output: out, cacheRead: cr, cacheWrite5m: c5, cacheWrite1h: c1 };
        costUsd += costForUsage(model, usage);
        const b = costBuckets(model, usage);
        costBreakdown.input += b.input;
        costBreakdown.output += b.output;
        costBreakdown.cacheRead += b.cacheRead;
        costBreakdown.cacheWrite5m += b.cacheWrite5m;
        costBreakdown.cacheWrite1h += b.cacheWrite1h;
        savedUsd += costSavedByCache(model, cr);
      }

      const content = o.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && block.type === "tool_use" && typeof block.name === "string") {
            toolCounts[block.name] = (toolCounts[block.name] ?? 0) + 1;
            if (block.name === "Edit" || block.name === "Write" || block.name === "MultiEdit") {
              const p = block.input?.file_path;
              if (typeof p === "string" && p) editedFiles.add(p);
            }
          }
        }
      }
    }

    if (o.type === "user" && o.message && !o.isMeta) {
      const { text, toolResultOnly } = extractUserText(o.message.content);
      if (!text || toolResultOnly) continue;

      // slash commands embedded as <command-name>/foo</command-name>
      const cmdMatch = [...text.matchAll(/<command-name>\s*(\/[\w:-]+)/g)];
      for (const m of cmdMatch) {
        slashCommands.add(m[1]);
        if (m[1] === "/clear") clears++;
      }
      if (text.includes("Request interrupted by user")) {
        interruptions++;
        continue;
      }
      // Strip slash-command wrappers and local-command caveats — what remains is the
      // real free-form prompt (if any). Drop the message only if nothing is left.
      const cleaned = text
        .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
        .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
        .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
        .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
        .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
        .trim();
      if (!cleaned) continue;

      promptTexts.push(cleaned);
      if (!firstPrompt) firstPrompt = cleaned;

      const low = cleaned.toLowerCase();
      pleaseCount += (low.match(/\bplease\b/g) ?? []).length;
      thanksCount += (low.match(/\b(thanks|thank you|ty)\b/g) ?? []).length;

      for (const w of low.match(/[a-z]{3,}/g) ?? []) {
        if (!STOPWORDS.has(w)) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }
    }
  }

  // derive
  const startTs = tsList.length ? Math.min(...tsList) : null;
  const endTs = tsList.length ? Math.max(...tsList) : null;
  // Active duration: sum gaps between consecutive events, ignoring idle stretches
  // (a session resumed days later shouldn't read as a 72-hour grind).
  const IDLE_GAP_MS = 30 * 60 * 1000;
  const sorted = [...tsList].sort((a, b) => a - b);
  let durationMs = 0;
  for (let k = 1; k < sorted.length; k++) {
    const d = sorted[k] - sorted[k - 1];
    if (d > 0 && d <= IDLE_GAP_MS) durationMs += d;
  }

  let peakHour = 0;
  let peakCount = -1;
  for (let h = 0; h < 24; h++) {
    if (hourHist[h] > peakCount) {
      peakCount = hourHist[h];
      peakHour = h;
    }
  }
  const isNightOwl = peakHour >= 23 || peakHour < 5;

  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWrite5m + cacheWrite1h;
  const paidTokens = inputTokens + outputTokens + cacheWrite5m + cacheWrite1h;
  const cacheHitRatio = inputTokens + cacheReadTokens > 0
    ? cacheReadTokens / (inputTokens + cacheReadTokens)
    : 0;
  // The story-grade metric: what fraction of the would-be dollar cost was eliminated
  // by cache reads. Unlike cacheHitRatio this varies meaningfully across sessions.
  const cacheSaveDenom = savedUsd + costUsd;
  const cacheSaveRate = cacheSaveDenom > 0
    ? Math.max(0, Math.min(1, savedUsd / cacheSaveDenom))
    : 0;

  const totalToolCalls = Object.values(toolCounts).reduce((a, b) => a + b, 0);
  let dominantTool: string | null = null;
  let dominantCount = 0;
  for (const [name, n] of Object.entries(toolCounts)) {
    if (n > dominantCount) {
      dominantCount = n;
      dominantTool = name;
    }
  }
  const subagents = toolCounts["Task"] ?? 0;
  const editCallCount = (toolCounts["Edit"] ?? 0) + (toolCounts["Write"] ?? 0) + (toolCounts["MultiEdit"] ?? 0);
  const filesEdited = editedFiles.size;
  const bashCommands = toolCounts["Bash"] ?? 0;

  const avgPromptLen = promptTexts.length
    ? Math.round(promptTexts.reduce((a, t) => a + t.length, 0) / promptTexts.length)
    : 0;

  let mostUsedWord: string | null = null;
  let mostUsedCount = 1;
  for (const [w, n] of wordFreq) {
    if (n > mostUsedCount) {
      mostUsedCount = n;
      mostUsedWord = w;
    }
  }

  const rage = detectRage({
    clears,
    interruptions,
    promptTexts,
    endReason: undefined,
  });

  const modelList = [...models.keys()];
  let primaryModel: string | null = modelList[0] ?? null;
  let primaryCount = 0;
  for (const [m, n] of models) {
    if (n > primaryCount) {
      primaryCount = n;
      primaryModel = m;
    }
  }

  const title =
    aiTitle ||
    (firstPrompt ? firstPrompt.slice(0, 60).replace(/\s+/g, " ").trim() : "") ||
    (cwd ? basename(cwd) : "untitled session");

  return {
    sessionId,
    project: cwd ? basename(cwd) : "unknown",
    cwd,
    title,
    gitBranch,
    models: modelList,
    primaryModel,
    startTime: startTs !== null ? new Date(startTs).toISOString() : null,
    endTime: endTs !== null ? new Date(endTs).toISOString() : null,
    durationMs,
    peakHour,
    isNightOwl,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWrite5mTokens: cacheWrite5m,
    cacheWrite1hTokens: cacheWrite1h,
    totalTokens,
    paidTokens,
    cacheHitRatio,
    cacheSaveRate,
    costUsd,
    costBreakdown,
    savedUsd,
    toolCounts,
    totalToolCalls,
    dominantTool,
    subagents,
    filesEdited,
    editCallCount,
    bashCommands,
    userPrompts: promptTexts.length,
    assistantMessages,
    avgPromptLen,
    firstPrompt: firstPrompt || null,
    slashCommands: [...slashCommands],
    mostUsedWord,
    clears: rage.clears,
    interruptions: rage.interruptions,
    angryPrompts: rage.angryPrompts,
    rageScore: rage.rageScore,
    comeback: rage.comeback,
    pleaseCount,
    thanksCount,
  };
}
