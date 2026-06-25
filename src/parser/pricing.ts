// Per-million-token USD rates, verified from platform.claude.com/docs pricing (2026-05).
// Keyed by a normalized model family; we match the longest known prefix.
export interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

const RATES: Record<string, Rate> = {
  // Opus 4.5 / 4.6 / 4.7 share the same (cheaper) pricing
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  "claude-opus-4-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  // Opus 4 / 4.1 (older, pricier)
  "claude-opus-4-1": { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
  "claude-opus-4": { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
  // Sonnet 4.x
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
  // Haiku 4.5
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
  "claude-haiku-3-5": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite5m: 1, cacheWrite1h: 1.6 },
};

const DEFAULT_RATE = RATES["claude-opus-4-7"];

export function rateFor(model: string | undefined | null): Rate {
  if (!model) return DEFAULT_RATE;
  // longest matching known key
  let best: Rate | undefined;
  let bestLen = 0;
  for (const key of Object.keys(RATES)) {
    if (model.startsWith(key) && key.length > bestLen) {
      best = RATES[key];
      bestLen = key.length;
    }
  }
  return best ?? DEFAULT_RATE;
}

export interface UsageTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export function costForUsage(model: string | undefined, t: UsageTokens): number {
  const r = rateFor(model);
  return (
    (t.input * r.input +
      t.output * r.output +
      t.cacheRead * r.cacheRead +
      t.cacheWrite5m * r.cacheWrite5m +
      t.cacheWrite1h * r.cacheWrite1h) /
    1_000_000
  );
}

// Fun unit: "credits" = total tokens (always a big, satisfying number).
export function creditsFromTokens(totalTokens: number): number {
  return totalTokens;
}

// Translate a dollar amount into relatable real-world quantities (for roasts).
export interface RealWorld {
  bigMacs: number;
  lattes: number;
  spotifyMonths: number;
  netflixMonths: number;
  burritos: number;
}

export function toRealWorld(costUsd: number): RealWorld {
  return {
    bigMacs: costUsd / 5.69,
    lattes: costUsd / 4.5,
    spotifyMonths: costUsd / 11.99,
    netflixMonths: costUsd / 17.99,
    burritos: costUsd / 12.5,
  };
}
