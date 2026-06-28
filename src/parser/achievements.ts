import type { SessionStats, Badge } from "./types.ts";

interface BadgeDef extends Omit<Badge, "blurb"> {
  blurb: string;
  test: (s: SessionStats) => boolean;
}

// Ordered roughly by "flex value" — the card highlights the first few matched.
const CATALOG: BadgeDef[] = [
  {
    id: "token-tycoon",
    label: "Token Tycoon",
    emoji: "🪙",
    blurb: "Burned over a million tokens in one sitting.",
    test: (s) => s.totalTokens >= 1_000_000,
  },
  {
    id: "big-spender",
    label: "Big Spender",
    emoji: "💸",
    blurb: "Dropped serious cash this session.",
    test: (s) => s.costUsd >= 5,
  },
  {
    id: "subagent-whisperer",
    label: "Subagent Whisperer",
    emoji: "🤖",
    blurb: "Delegated like middle management.",
    test: (s) => s.subagents >= 5,
  },
  {
    id: "rage-quitter",
    label: "Rage Quitter",
    emoji: "😤",
    blurb: "Lost composure more than once.",
    test: (s) => s.rageScore >= 3,
  },
  {
    id: "comeback-kid",
    label: "Comeback Kid",
    emoji: "🔁",
    blurb: "Rage-spiked, then powered through anyway.",
    test: (s) => s.comeback,
  },
  {
    id: "night-owl",
    label: "Night Owl",
    emoji: "🦉",
    blurb: "Peak coding happened in the dead of night.",
    test: (s) => s.isNightOwl,
  },
  {
    id: "marathoner",
    label: "Marathoner",
    emoji: "🏃",
    blurb: "Sat in the same session for over two hours.",
    test: (s) => s.durationMs >= 2 * 60 * 60 * 1000,
  },
  {
    id: "cache-freeloader",
    label: "Cache Freeloader",
    emoji: "🧊",
    blurb: "Caching saved most of what this session would have cost.",
    test: (s) => s.cacheSaveRate >= 0.6 && s.costUsd >= 0.5,
  },
  {
    id: "bash-bro",
    label: "Bash Bro",
    emoji: "🔧",
    blurb: "Lived in the terminal.",
    test: (s) => s.dominantTool === "Bash" && s.bashCommands >= 5,
  },
  {
    id: "edit-warrior",
    label: "Edit Warrior",
    emoji: "✏️",
    blurb: "Rewrote half the codebase.",
    test: (s) => s.dominantTool === "Edit" && s.filesEdited >= 5,
  },
  {
    id: "speedrunner",
    label: "Speedrunner",
    emoji: "⚡",
    blurb: "Big output in record time.",
    test: (s) => s.durationMs > 0 && s.durationMs < 10 * 60 * 1000 && s.outputTokens >= 20_000,
  },
  {
    id: "yak-shaver",
    label: "Yak Shaver",
    emoji: "🐃",
    blurb: "Tons of tool calls, barely any edits.",
    test: (s) => s.totalToolCalls >= 30 && s.filesEdited <= 2,
  },
  {
    id: "polite-one",
    label: "The Polite One",
    emoji: "🙏",
    blurb: "Said please and thank you to a language model.",
    test: (s) => s.pleaseCount + s.thanksCount >= 3,
  },
  {
    id: "the-closer",
    label: "The Closer",
    emoji: "🎯",
    blurb: "Wrapped it up clean, zero rage.",
    test: (s) => s.rageScore === 0 && s.userPrompts >= 4 && s.filesEdited >= 1,
  },
  {
    id: "one-liner",
    label: "Man of Few Words",
    emoji: "🤏",
    blurb: "Got a lot done with tiny prompts.",
    test: (s) => s.userPrompts >= 4 && s.avgPromptLen > 0 && s.avgPromptLen <= 25,
  },
];

export function computeBadges(stats: SessionStats): Badge[] {
  return CATALOG.filter((b) => {
    try {
      return b.test(stats);
    } catch {
      return false;
    }
  }).map(({ id, label, emoji, blurb }) => ({ id, label, emoji, blurb }));
}
