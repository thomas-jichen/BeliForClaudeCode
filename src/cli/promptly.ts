#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { writeConfig, readConfig } from "../hook/config.ts";
import { startServer } from "../server/index.ts";
import { DEFAULT_PORT, ensureDirs } from "../shared/paths.ts";

const REPO_ROOT = join(import.meta.dirname, "../..");
const HOOK_PATH = join(REPO_ROOT, "src/hook/hook.ts");
const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const WEB_DIST_INDEX = join(REPO_ROOT, "web/dist/index.html");

function hookCommand(): string {
  return `${process.execPath} ${HOOK_PATH}`;
}

export function installHook(settingsPath: string = SETTINGS_PATH): "added" | "exists" {
  mkdirSync(dirname(settingsPath), { recursive: true });
  let settings: any = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    } catch {
      // back up an unparseable file rather than clobbering it
      copyFileSync(settingsPath, settingsPath + ".promptly-bak");
      settings = {};
    }
  }
  settings.hooks = settings.hooks ?? {};
  const list: any[] = Array.isArray(settings.hooks.SessionEnd) ? settings.hooks.SessionEnd : [];
  const cmd = hookCommand();
  const already = list.some((entry) =>
    Array.isArray(entry?.hooks) && entry.hooks.some((h: any) => h?.command === cmd),
  );
  if (already) return "exists";
  list.push({ hooks: [{ type: "command", command: cmd }] });
  settings.hooks.SessionEnd = list;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return "added";
}

async function cmdInit() {
  ensureDirs();
  const existing = readConfig();
  let handle = existing.handle;
  let avatar = existing.avatar;

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const h = (await rl.question(`👋 Pick a handle [${handle}]: `)).trim();
    if (h) handle = h;
    const a = (await rl.question(`😎 Pick an avatar emoji [${avatar}]: `)).trim();
    if (a) avatar = a;
    rl.close();
  }

  const cfg = writeConfig({ handle, avatar });
  const hookResult = installHook();

  console.log(`\n✅ Promptly configured for @${cfg.handle} ${cfg.avatar}`);
  console.log(`   config:   ~/.promptly/config.json`);
  console.log(
    hookResult === "added"
      ? `   hook:     added SessionEnd hook to ~/.claude/settings.json`
      : `   hook:     SessionEnd hook already installed`,
  );
  console.log(`\nNext: run "npm run serve" to start your feed, then code as usual.`);
  console.log(`When a session ends, your post appears automatically. 🎉\n`);
}

function ensureWebBuilt(force = false) {
  if (!force && existsSync(WEB_DIST_INDEX)) return;
  console.log("🏗️  Building web UI (first run)...");
  const r = spawnSync("npx", ["vite", "build", "web"], { cwd: REPO_ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("⚠️  Web build failed — the API will still run, but the UI won't load.");
  }
}

function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* ignore */
  }
}

async function cmdServe(argv: string[]) {
  const portArg = argv.indexOf("--port");
  const port = portArg !== -1 ? Number(argv[portArg + 1]) : DEFAULT_PORT;
  const rebuild = argv.includes("--rebuild");
  ensureWebBuilt(rebuild);
  await startServer(port);
  openBrowser(`http://localhost:${port}`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case "init":
      await cmdInit();
      break;
    case "serve":
      await cmdServe(rest);
      break;
    default:
      console.log(`Promptly — Beli/Strava for Claude Code

Usage:
  npm run init     Configure your handle + install the SessionEnd hook
  npm run serve    Start the feed at http://localhost:${DEFAULT_PORT} (auto-opens browser)

After init, just code. When a Claude Code session ends, a post appears automatically.`);
  }
}

// Only run the dispatcher when invoked directly (not when imported for its exports).
if (process.argv[1] && process.argv[1].endsWith("promptly.ts")) {
  main();
}
