# Promptly: Beli for Claude Code

A minimal, Japandi-inspired dashboard that turns your local Claude Code sessions into beautiful Beli-style social posts. It tracks your coding velocity, scores session complexity, and lets you share roasts and stats with friends—all hosted locally.

---

## Quick Start

```bash
npm install
npm run init     # Configure your handle & register the Claude Code hook
npm run serve    # Boot your dashboard at http://localhost:4321
```

Once registered, coding sessions that exceed your token threshold automatically post to your feed. Smaller sessions are stored as drafts for manual review.

---

## Design System

Designed around a warm, organic wabi-sabi palette, frosted glassmorphism overlays, and quiet typography.

* **Terracotta Pebble**: A hand-shaped, terracotta-gradient brand pebble logo combining a developer prompt caret (`>`) and a serif monogram `P`. It reacts with a rotating bounce on hover.
* **Serif post-flow**: Social cards display session summaries and AI-generated roasts in a unified, editorial serif layout (`Newsreader`).
* **Calming backdrops**: Hand-curated minimalist Japandi imagery displays behind the interface, changing randomly on mount.

---

## Architecture

1. **Session Ending**: The native `SessionEnd` hook fires instantly on terminal exit, running a detached worker in the background so it never blocks your terminal.
2. **Metadata Parsing**: The worker parses your local session transcript (`~/.claude/projects/**/<session>.jsonl`) to extract tool calls, active coding duration, files edited, and precise model costs. *No prompt text or source code ever leaves your machine.*
3. **Earthy Scoring**: Using the local CLI (`claude -p`), the session is rated from `0.0` to `10.0` and reviewed with a witty roast line.
4. **Social post creation**: The completed card is POSTed to the local DB (`~/.promptly/data.json`) and triggers a system desktop notification.

### Where each thing on the card comes from

The card has three textual outputs and three different sources. Hover the little pill next to the
roast on any post to see the exact stats text Promptly sent to the LLM.

| Field on the card                          | Source                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Title                                      | Claude Code's own `aiTitle` event in the transcript (falls back to first prompt → cwd)    |
| Model, tokens, cost, tools, duration, etc. | Parsed deterministically from the transcript (`src/parser/parseSession.ts`)               |
| Statlines ("🔥 burned …", "💸 $… — Big Macs") | Rule-based templates in `src/shared/post.ts` (no LLM)                                     |
| Achievement badges (Token Tycoon, …)       | Rule-based catalog in `src/parser/achievements.ts` (no LLM)                               |
| **Score (0–10) + one-line roast**          | **LLM call — `claude -p --model claude-haiku-4-5`** via `src/scoring/score.ts`. Stats-only prompt (no code/prompt text). Deterministic templated fallback if the call fails. |

### Headline number on each card

The hero on each card is **output tokens** — what Claude actually generated in this slice of the
session — paired with the **$ spent** (computed per-model from the per-MTok rate table in
`src/parser/pricing.ts`). Cache reads still feed the *Cache Freeloader* badge but no longer have a
dedicated tile.

### Time on each card

`createdAt` is **the session's actual end time** (the last timestamp in the transcript). The
server never overwrites it — not on insert, not on publish, not on outbox drain. So a session you
ran two weeks ago that publishes today reads as "2w ago", not "just now".

---

## Dashboard Features

* **Control Deck**: Left navigation sidebar displaying your weekly progress metrics, active tab selectors, and live coding status.
* **Home Feed**: Visual chronological feed with Friends and Global scopes. Includes expandable reaction emoji drawers and inline thread discussions.
* **Leaderboard**: Ranked index of active builders, listing weekly output tokens, average session score, and trend trajectories.
* **Profile**: Personal summary deck featuring unlocked achievements/badges, auto-share configuration sliders, drafts management, and a 24-hour coding intensity heatmap grid.

---

## Technical Details

* **Local Storage**: All application data, outbox queues, logs, and user preferences reside entirely inside `~/.promptly/`.
* **Zero Dependency backend**: Uses Node 22+ native TypeScript execution for the daemon hook.
* **Uninstallation**: Remove the hook pointer from `~/.claude/settings.json` and delete the `~/.promptly/` data directory.
