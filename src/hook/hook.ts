// Claude Code SessionEnd hook entry point.
// Reads the SessionEnd payload from stdin, then spawns a DETACHED worker so this
// process can return instantly — SessionEnd hooks must never block shutdown, and
// their output is ignored anyway. All real work (parse → score → post) is in worker.ts.
import { spawn } from "node:child_process";
import { join } from "node:path";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const t = setTimeout(() => resolve(data), 2000); // don't hang if no stdin
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => {
      clearTimeout(t);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

async function main() {
  const raw = await readStdin();
  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    /* no/invalid payload — nothing to do */
  }
  const transcriptPath: string | undefined = payload.transcript_path;
  const reason: string = payload.reason ?? "other";
  if (!transcriptPath) return;

  const workerPath = join(import.meta.dirname, "worker.ts");
  const child = spawn(process.execPath, [workerPath, transcriptPath, reason], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

main().finally(() => process.exit(0));
