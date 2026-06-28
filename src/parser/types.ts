export interface ToolCounts {
  [name: string]: number;
}

export interface SessionStats {
  sessionId: string;
  project: string;
  cwd: string;
  title: string;
  gitBranch?: string;

  models: string[];
  primaryModel: string | null;

  startTime: string | null;
  endTime: string | null;
  durationMs: number;
  peakHour: number; // 0-23, local hour with most activity
  isNightOwl: boolean;

  // tokens
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  totalTokens: number;       // input + output + cacheRead + cacheWrite (everything)
  paidTokens: number;        // input + output + cacheWrite (cache reads excluded)
  cacheHitRatio: number;     // cacheRead / (input + cacheRead) — saturates near 100% on long sessions; prefer cacheSaveRate for display
  cacheSaveRate: number;     // savedUsd / (savedUsd + costUsd) — fraction of would-be cost that caching eliminated; the meaningful metric

  // cost
  costUsd: number;
  costBreakdown: {        // per-bucket $ — sums to costUsd by construction
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite5m: number;
    cacheWrite1h: number;
  };
  savedUsd: number;       // $ saved by cache reads (vs. fresh-input billing at the same rate)

  // tools
  toolCounts: ToolCounts;
  totalToolCalls: number;
  dominantTool: string | null;
  subagents: number;            // Task tool calls
  filesEdited: number;          // unique file paths touched by Edit/Write/MultiEdit
  editCallCount: number;        // raw Edit+Write+MultiEdit call count
  bashCommands: number;

  // prompts
  userPrompts: number;
  assistantMessages: number;
  avgPromptLen: number;
  firstPrompt: string | null;   // worker uses this to detect & skip self-scoring transcripts
  slashCommands: string[];
  mostUsedWord: string | null;

  // rage
  clears: number;
  interruptions: number;
  angryPrompts: number;
  rageScore: number;
  comeback: boolean;

  // flavor
  pleaseCount: number;
  thanksCount: number;

  endReason?: string;
}

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
}
