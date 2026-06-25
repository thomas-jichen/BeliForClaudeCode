// Rage-quit signal detection. Operates on lightweight signals collected by the parser
// so it never needs the raw transcript text to leave parseSession.

const ANGRY_TOKENS = new Set([
  "no", "nope", "stop", "wait", "ugh", "wtf", "wth", "argh", "ffs",
  "undo", "revert", "dammit", "damn", "why", "broken", "wrong", "fix",
  "again", "still", "nooo", "noooo", "redo",
]);

export interface RageInput {
  endReason?: string;          // SessionEnd reason ("clear" etc.)
  clears: number;              // number of /clear command events seen in transcript
  interruptions: number;       // "[Request interrupted by user]" markers
  promptTexts: string[];       // raw user prompt strings (stay local)
}

export interface RageResult {
  clears: number;
  interruptions: number;
  angryPrompts: number;
  rageScore: number;
  comeback: boolean;
}

// A prompt counts as "angry" if it's short and dominated by frustration words.
function isAngry(text: string): boolean {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (tokens.length === 0 || tokens.length > 6) return false;
  return tokens.some((t) => ANGRY_TOKENS.has(t));
}

export function detectRage(input: RageInput): RageResult {
  const angryPrompts = input.promptTexts.filter(isAngry).length;
  const clears = input.clears + (input.endReason === "clear" ? 1 : 0);

  // Weighted: interruptions hurt most, then angry prompts, then clears.
  const rageScore = input.interruptions * 2 + angryPrompts * 1.5 + clears * 1;

  // Comeback: got frustrated but kept going (more prompts came after the storm).
  const stormy = input.interruptions > 0 || angryPrompts > 0;
  const comeback = stormy && input.promptTexts.length >= 3;

  return {
    clears,
    interruptions: input.interruptions,
    angryPrompts,
    rageScore: Math.round(rageScore * 10) / 10,
    comeback,
  };
}
