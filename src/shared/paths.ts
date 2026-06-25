import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export const DATA_DIR = join(homedir(), ".promptly");
export const DATA_FILE = join(DATA_DIR, "data.json");
export const CONFIG_FILE = join(DATA_DIR, "config.json");
export const OUTBOX_DIR = join(DATA_DIR, "outbox");

export const DEFAULT_PORT = 4321;
export const DEFAULT_BACKEND = `http://localhost:${DEFAULT_PORT}`;

export function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(OUTBOX_DIR, { recursive: true });
}
