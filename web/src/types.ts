export interface Badge {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
}

export interface PostStats {
  costUsd: number;
  savedUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  paidTokens: number;
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

export interface PostScoring {
  source: "llm" | "fallback";
  model: string;
  promptSent: string;
}

export interface Comment {
  id: string;
  handle: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  handle: string;
  avatar: string;
  project: string;
  title: string;
  sessionId: string;
  score: number;
  review: string;
  scoring?: PostScoring;
  statlines: string[];
  stats: PostStats;
  badges: Badge[];
  isDraft: boolean;
  createdAt: string;     // session truth — when the session actually ended
  postedAt?: string;     // server stamp — when post hit the feed
  publishedAt?: string;  // server stamp — when a draft was published
  reactions: Record<string, number>;
  comments?: Comment[];
}

export interface Profile {
  handle: string;
  name?: string;
  avatar: string;
  autoShareMinTokens: number;
}
