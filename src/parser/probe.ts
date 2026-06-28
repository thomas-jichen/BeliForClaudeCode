// Dev probe: `node src/parser/probe.ts <transcript.jsonl>`
import { parseSession } from "./parseSession.ts";
import { computeBadges } from "./achievements.ts";
import { toRealWorld } from "./pricing.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: node src/parser/probe.ts <transcript.jsonl>");
  process.exit(1);
}
const s = parseSession(path);
const badges = computeBadges(s);
const rw = toRealWorld(s.costUsd);

console.log("title:", s.title);
console.log("project:", s.project, "| branch:", s.gitBranch);
console.log("model:", s.primaryModel, "| all:", s.models);
console.log("duration(min):", (s.durationMs / 60000).toFixed(1), "| peakHour:", s.peakHour, "| nightOwl:", s.isNightOwl);
console.log("tokens:", { input: s.inputTokens, output: s.outputTokens, cacheRead: s.cacheReadTokens, w5: s.cacheWrite5mTokens, w1: s.cacheWrite1hTokens, total: s.totalTokens });
console.log("output:", s.outputTokens.toLocaleString(), "| input:", s.inputTokens.toLocaleString(), "| cacheHitRatio:", s.cacheHitRatio.toFixed(2));
console.log("cost: $" + s.costUsd.toFixed(2), "=", rw.bigMacs.toFixed(1), "Big Macs |", rw.lattes.toFixed(1), "lattes");
console.log("tools:", s.toolCounts);
console.log("subagents:", s.subagents, "| filesEdited:", s.filesEdited, "| bash:", s.bashCommands, "| dominant:", s.dominantTool);
console.log("prompts:", s.userPrompts, "| avgLen:", s.avgPromptLen, "| mostUsedWord:", s.mostUsedWord, "| slash:", s.slashCommands);
console.log("rage:", { score: s.rageScore, clears: s.clears, interruptions: s.interruptions, angry: s.angryPrompts, comeback: s.comeback });
console.log("manners: please", s.pleaseCount, "thanks", s.thanksCount);
console.log("badges:", badges.map((b) => b.emoji + " " + b.label).join("  "));
