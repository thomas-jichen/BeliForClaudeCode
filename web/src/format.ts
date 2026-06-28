export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCost(usd: number): string {
  if (usd >= 1000) return "$" + (usd / 1000).toFixed(1) + "k";
  if (usd >= 100) return "$" + Math.round(usd);
  return "$" + usd.toFixed(2);
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Derive a friendly model label directly from the model id (no hardcoded mappings —
// adding a new Claude family shouldn't require touching this file).
//   claude-opus-4-8           → "Opus 4.8"
//   claude-sonnet-4-6         → "Sonnet 4.6"
//   claude-haiku-4-5          → "Haiku 4.5"
//   claude-fable-5            → "Fable 5"
//   claude-opus-4-8-20260415  → "Opus 4.8"   (trailing date suffix stripped)
//   null / unknown shape      → ""           (don't render anything)
export function formatModel(model: string | null | undefined): string {
  if (!model) return "";
  const m = model.toLowerCase();
  const match = m.match(/^claude-(opus|sonnet|haiku|fable|mythos)-(\d+(?:-\d+)?)/);
  if (!match) return model;
  const family = match[1][0].toUpperCase() + match[1].slice(1);
  const version = match[2].replace("-", ".");
  return `${family} ${version}`;
}

// Score → CSS color, graded red(low) → amber → acid-lime(high).
export function scoreColor(score: number): string {
  if (score >= 8.5) return "var(--acid)";
  if (score >= 7) return "var(--lime)";
  if (score >= 5) return "var(--amber)";
  if (score >= 3.5) return "var(--ember)";
  return "var(--rust)";
}
