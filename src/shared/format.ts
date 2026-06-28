// Formatting helpers shared by the post builder, seed data, and (bundled) the web UI.

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCost(usd: number): string {
  if (usd >= 1000) return "$" + (usd / 1000).toFixed(1) + "k";
  if (usd >= 100) return "$" + Math.round(usd);
  return "$" + usd.toFixed(2);
}

export function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

// Derive a friendly model label from a Claude model id (e.g. "claude-opus-4-8" → "Opus 4.8").
// Returns "" if the id can't be parsed. Mirrors web/src/format.ts:formatModel so the
// worker's scoring prompt names the model the same way the UI labels it on the card.
export function formatModel(model: string | null | undefined): string {
  if (!model) return "";
  const m = model.toLowerCase();
  const match = m.match(/^claude-(opus|sonnet|haiku|fable|mythos)-(\d+(?:-\d+)?)/);
  if (!match) return model;
  const family = match[1][0].toUpperCase() + match[1].slice(1);
  const version = match[2].replace("-", ".");
  return `${family} ${version}`;
}

export function fmtHour(h: number): string {
  const ampm = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}
