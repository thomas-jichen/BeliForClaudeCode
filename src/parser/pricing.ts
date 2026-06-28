// Per-million-token USD rates, verified against the official Anthropic pricing table
// supplied by the user (2026-06). Keyed by normalized model family; longest-prefix match.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../shared/paths.ts";

export interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

// Opus 4.5 → 4.8 share the "cheap" Opus tier.
const OPUS_CHEAP: Rate = { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 };
// Older Opus tier (4 / 4.1) — deprecated / retired but still pricing-table valid.
const OPUS_LEGACY: Rate = { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 };
// Sonnet 4.x family.
const SONNET_4: Rate = { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 };
// Fable 5 / Mythos 5 — premium tier, double Opus-cheap.
const PREMIUM_5: Rate = { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 };

const RATES: Record<string, Rate> = {
  // Premium-5 family.
  "claude-fable-5": PREMIUM_5,
  "claude-mythos-5": PREMIUM_5,
  // Opus 4.5 → 4.8.
  "claude-opus-4-8": OPUS_CHEAP,
  "claude-opus-4-7": OPUS_CHEAP,
  "claude-opus-4-6": OPUS_CHEAP,
  "claude-opus-4-5": OPUS_CHEAP,
  // Legacy Opus.
  "claude-opus-4-1": OPUS_LEGACY,
  "claude-opus-4": OPUS_LEGACY,
  // Sonnet 4.x.
  "claude-sonnet-4-6": SONNET_4,
  "claude-sonnet-4-5": SONNET_4,
  "claude-sonnet-4": SONNET_4,
  // Haiku.
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
  "claude-haiku-3-5": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite5m: 1, cacheWrite1h: 1.6 },
};

const DEFAULT_RATE = OPUS_CHEAP;
const warnedModels = new Set<string>();

function warnUnknownModel(model: string): void {
  if (warnedModels.has(model)) return;
  warnedModels.add(model);
  try {
    appendFileSync(
      join(DATA_DIR, "worker.log"),
      `[${new Date().toISOString()}] pricing.rateFor: unknown model "${model}" — using default OPUS_CHEAP rate\n`,
    );
  } catch {
    /* ignore */
  }
}

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
  if (!best) warnUnknownModel(model);
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

// Per-bucket dollars for auditing — same lookup as costForUsage, so the breakdown
// and the total cannot drift from each other.
export interface CostBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export function costBreakdown(model: string | undefined | null, t: UsageTokens): CostBreakdown {
  const r = rateFor(model);
  return {
    input: (t.input * r.input) / 1_000_000,
    output: (t.output * r.output) / 1_000_000,
    cacheRead: (t.cacheRead * r.cacheRead) / 1_000_000,
    cacheWrite5m: (t.cacheWrite5m * r.cacheWrite5m) / 1_000_000,
    cacheWrite1h: (t.cacheWrite1h * r.cacheWrite1h) / 1_000_000,
  };
}

// Dollar amount the user would have paid if every cache-read token had been billed
// as fresh input instead. For cheap-tier Opus that's ~$4.50 per million cache reads.
export function costSavedByCache(model: string | undefined | null, cacheReadTokens: number): number {
  const r = rateFor(model);
  return (cacheReadTokens * (r.input - r.cacheRead)) / 1_000_000;
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
