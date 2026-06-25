import type { Post, PostStats } from "../shared/post.ts";
import type { Badge } from "../parser/types.ts";

function ago(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function b(id: string, label: string, emoji: string, blurb: string): Badge {
  return { id, label, emoji, blurb };
}

function mkStats(p: Partial<PostStats>): PostStats {
  return {
    costUsd: 0,
    totalTokens: 0,
    credits: 0,
    subagents: 0,
    durationMs: 0,
    filesEdited: 0,
    bashCommands: 0,
    totalToolCalls: 0,
    dominantTool: null,
    rageScore: 0,
    interruptions: 0,
    clears: 0,
    cacheHitRatio: 0,
    userPrompts: 0,
    peakHour: 12,
    isNightOwl: false,
    primaryModel: "claude-opus-4-7",
    ...p,
  };
}

export function seedPosts(): Post[] {
  return [
    {
      id: "seed-vivan",
      handle: "vivan",
      avatar: "🦖",
      project: "monolith-api",
      title: "rewrite the entire auth layer (again)",
      sessionId: "seed-vivan",
      score: 9.4,
      review: "Burned $312 and rage-quit 7×. The auth layer won. It always wins.",
      statlines: [
        "🔥 burned 23,948,203 tokens with 3 subagents",
        "💸 $312 — that's 2,000 Big Macs (his math, not ours)",
        "😤 rage-quit 7×",
        "🦉 peak grind at 2am",
      ],
      stats: mkStats({
        costUsd: 312,
        totalTokens: 23_948_203,
        credits: 23_948_203,
        subagents: 3,
        durationMs: 4 * 3600_000 + 12 * 60_000,
        filesEdited: 41,
        bashCommands: 88,
        totalToolCalls: 210,
        dominantTool: "Edit",
        rageScore: 14,
        interruptions: 7,
        cacheHitRatio: 0.91,
        userPrompts: 96,
        peakHour: 2,
        isNightOwl: true,
      }),
      badges: [
        b("token-tycoon", "Token Tycoon", "🪙", "Burned over a million tokens in one sitting."),
        b("big-spender", "Big Spender", "💸", "Dropped serious cash this session."),
        b("rage-quitter", "Rage Quitter", "😤", "Lost composure more than once."),
        b("night-owl", "Night Owl", "🦉", "Peak coding happened in the dead of night."),
      ],
      isDraft: false,
      createdAt: ago(4),
      reactions: { "🔥": 12, "😭": 5, "👑": 8 },
      comments: [
        {
          id: "comment-vivan-1",
          handle: "mei",
          avatar: "🐱",
          text: "Rage-quit 7× is too real. The auth layer is a boss fight.",
          createdAt: ago(3)
        },
        {
          id: "comment-vivan-2",
          handle: "priya",
          avatar: "⚡",
          text: "Sonnet 4 handles JWT verification much better if you reference standard specs.",
          createdAt: ago(1)
        }
      ]
    },
    {
      id: "seed-mei",
      handle: "mei",
      avatar: "🐱",
      project: "ml-pipeline",
      title: "vectorize the feature store",
      sessionId: "seed-mei",
      score: 8.1,
      review: "12 subagents doing her bidding. Somebody discovered delegation.",
      statlines: [
        "🤖 commanded 12 subagents",
        "🔥 burned 8,402,118 tokens with 12 subagents",
        "💸 $47 — that's 8 Big Macs",
        "⏱️ 2h 5m of active coding",
      ],
      stats: mkStats({
        costUsd: 47,
        totalTokens: 8_402_118,
        credits: 8_402_118,
        subagents: 12,
        durationMs: 2 * 3600_000 + 5 * 60_000,
        filesEdited: 23,
        bashCommands: 31,
        totalToolCalls: 140,
        dominantTool: "Edit",
        rageScore: 0,
        cacheHitRatio: 0.86,
        userPrompts: 38,
        peakHour: 15,
      }),
      badges: [
        b("subagent-whisperer", "Subagent Whisperer", "🤖", "Delegated like middle management."),
        b("token-tycoon", "Token Tycoon", "🪙", "Burned over a million tokens in one sitting."),
        b("cache-freeloader", "Cache Freeloader", "🧊", "Most of the context was free cache reads."),
        b("the-closer", "The Closer", "🎯", "Wrapped it up clean, zero rage."),
      ],
      isDraft: false,
      createdAt: ago(38),
      reactions: { "🤖": 9, "🔥": 6 },
      comments: [
        {
          id: "comment-mei-1",
          handle: "deshawn",
          avatar: "🐉",
          text: "12 subagents doing concurrent search is agentmaxxing to the limit.",
          createdAt: ago(25)
        }
      ]
    },
    {
      id: "seed-deshawn",
      handle: "deshawn",
      avatar: "🐉",
      project: "side-quest",
      title: "fix one css bug",
      sessionId: "seed-deshawn",
      score: 3.2,
      review: "Came to fix one bug. Touched 0 files. Said 'please' 9 times. We see you.",
      statlines: [
        "🙏 was polite 9× (to a robot)",
        "💬 27 prompts sent",
        "💸 $4 — that's 0.70 of a Big Mac",
        "✏️ edited 0 files",
      ],
      stats: mkStats({
        costUsd: 4.1,
        totalTokens: 612_400,
        credits: 612_400,
        subagents: 0,
        durationMs: 41 * 60_000,
        filesEdited: 0,
        bashCommands: 3,
        totalToolCalls: 18,
        dominantTool: "Read",
        rageScore: 0,
        cacheHitRatio: 0.74,
        userPrompts: 27,
        peakHour: 14,
      }),
      badges: [b("polite-one", "The Polite One", "🙏", "Said please and thank you to a language model.")],
      isDraft: false,
      createdAt: ago(95),
      reactions: { "💀": 7, "😭": 3 },
    },
    {
      id: "seed-priya",
      handle: "priya",
      avatar: "⚡",
      project: "cli-tool",
      title: "ship the release in one shot",
      sessionId: "seed-priya",
      score: 9.0,
      review: "20k output tokens in 8 minutes flat. Touch grass? Never heard of it.",
      statlines: [
        "⚡ 24,800 output tokens in 8m",
        "🔥 burned 1,204,556 tokens",
        "✏️ edited 9 files",
        "🎯 zero rage, clean exit",
      ],
      stats: mkStats({
        costUsd: 6.2,
        totalTokens: 1_204_556,
        credits: 1_204_556,
        subagents: 1,
        durationMs: 8 * 60_000,
        filesEdited: 9,
        bashCommands: 12,
        totalToolCalls: 44,
        dominantTool: "Edit",
        rageScore: 0,
        cacheHitRatio: 0.81,
        userPrompts: 6,
        peakHour: 10,
      }),
      badges: [
        b("speedrunner", "Speedrunner", "⚡", "Big output in record time."),
        b("token-tycoon", "Token Tycoon", "🪙", "Burned over a million tokens in one sitting."),
        b("the-closer", "The Closer", "🎯", "Wrapped it up clean, zero rage."),
      ],
      isDraft: false,
      createdAt: ago(180),
      reactions: { "⚡": 11, "🔥": 4, "👏": 6 },
      comments: [
        {
          id: "comment-priya-1",
          handle: "vivan",
          avatar: "🦖",
          text: "One-shot on a release? Cache God status confirmed.",
          createdAt: ago(120)
        }
      ]
    },
  ];
}
