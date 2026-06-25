export interface Badge {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
}

export interface PostStats {
  costUsd: number;
  totalTokens: number;
  credits: number;
  subagents: number;
  durationMs: number;
  filesEdited: number;
  bashCommands: number;
  totalToolCalls: number;
  dominantTool: string | null;
  rageScore: number;
  interruptions: number;
  clears: number;
  cacheHitRatio: number;
  userPrompts: number;
  peakHour: number;
  isNightOwl: boolean;
  primaryModel: string;
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
  statlines: string[];
  stats: PostStats;
  badges: Badge[];
  isDraft: boolean;
  createdAt: string;
  reactions: Record<string, number>;
  comments?: Comment[];
}

export interface Profile {
  handle: string;
  name?: string;
  avatar: string;
  autoShareMinTokens: number;
}
