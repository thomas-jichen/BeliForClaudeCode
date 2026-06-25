import { readFileSync, writeFileSync } from "node:fs";
import { CONFIG_FILE, DEFAULT_BACKEND, ensureDirs } from "../shared/paths.ts";

export interface PromptlyConfig {
  handle: string;
  avatar: string; // emoji
  backendUrl: string;
  autoShareMinTokens: number; // sessions below this many total tokens are saved as drafts
}

export const DEFAULT_CONFIG: PromptlyConfig = {
  handle: "you",
  avatar: "🧑‍💻",
  backendUrl: DEFAULT_BACKEND,
  autoShareMinTokens: 10_000,
};

export function readConfig(): PromptlyConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(cfg: Partial<PromptlyConfig>): PromptlyConfig {
  ensureDirs();
  const merged = { ...readConfig(), ...cfg };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
