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
  primaryModel: string;

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
  totalTokens: number;
  credits: number;
  cacheHitRatio: number; // cacheRead / (input + cacheRead)

  // cost
  costUsd: number;

  // tools
  toolCounts: ToolCounts;
  totalToolCalls: number;
  dominantTool: string | null;
  subagents: number; // Task tool calls
  filesEdited: number; // Edit + Write + MultiEdit calls
  bashCommands: number;

  // prompts
  userPrompts: number;
  assistantMessages: number;
  avgPromptLen: number;
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
