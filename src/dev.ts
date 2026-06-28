// `npm run dev` — runs backend + Vite together with hot reload.
//
//   - Backend (Express + worker-log tail) is launched with `node --watch`, so any
//     edit under src/ restarts it automatically.
//   - Vite dev server runs the React app at http://localhost:5173 with HMR. Its
//     config already proxies /api → http://localhost:4321.
//   - The browser opens once to the Vite URL; backend restarts don't re-open it.
//
// Quit with Ctrl-C; both children are killed.
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const VITE_URL = "http://localhost:5173";

const children: ChildProcess[] = [];

function start(name: string, color: string, cmd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  child.stdout?.on("data", (d) => {
    for (const line of d.toString().replace(/\n$/, "").split("\n")) process.stdout.write(prefix + line + "\n");
  });
  child.stderr?.on("data", (d) => {
    for (const line of d.toString().replace(/\n$/, "").split("\n")) process.stderr.write(prefix + line + "\n");
  });
  child.on("exit", (code) => {
    process.stderr.write(prefix + `exited with code ${code}\n`);
    shutdown();
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* ignore */ }
  }
  setTimeout(() => process.exit(0), 200).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* ignore */
  }
}

// 1. Backend with auto-restart. PROMPTLY_NO_BUILD skips the one-shot vite build
// (Vite dev server is serving the UI). PROMPTLY_NO_OPEN keeps the browser from
// re-opening on every backend restart.
start("api", "36", process.execPath, ["--watch", "src/cli/promptly.ts", "serve"], {
  PROMPTLY_NO_OPEN: "1",
  PROMPTLY_NO_BUILD: "1",
});

// 2. Vite dev server (HMR).
start("web", "35", "npx", ["vite", "web"]);

// 3. Open the browser once, to the Vite URL (NOT the API URL).
setTimeout(() => openBrowser(VITE_URL), 1500);

process.stdout.write(`\n  🚀 dev mode\n  • web (HMR):  ${VITE_URL}\n  • api:        http://localhost:4321\n  • backend auto-restarts on file change, web hot-reloads.\n  • Ctrl-C to stop.\n\n`);
