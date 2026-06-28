// Stream new bytes appended to a file to stdout. Used by `npm run serve` to surface
// the worker's per-session log to the terminal — the SessionEnd hook is detached so
// its own stdout goes nowhere; this is the only way for the user to watch it live.
import { openSync, fstatSync, readSync, watch, existsSync, closeSync, writeFileSync } from "node:fs";

export function tailToStdout(path: string, prefix = ""): void {
  if (!existsSync(path)) {
    try {
      writeFileSync(path, "");
    } catch {
      return;
    }
  }
  let offset = 0;
  try {
    offset = fstatSync(openSync(path, "r")).size;
  } catch {
    offset = 0;
  }

  let pending = "";
  const buf = Buffer.alloc(64 * 1024);
  const flush = () => {
    let fd: number | null = null;
    try {
      fd = openSync(path, "r");
      const size = fstatSync(fd).size;
      if (size < offset) offset = 0; // file truncated/rotated
      while (offset < size) {
        const n = readSync(fd, buf, 0, Math.min(buf.length, size - offset), offset);
        if (n <= 0) break;
        offset += n;
        pending += buf.subarray(0, n).toString("utf8");
      }
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        process.stdout.write(prefix + line + "\n");
      }
    } catch {
      /* ignore — next event will retry */
    } finally {
      if (fd !== null) {
        try { closeSync(fd); } catch { /* ignore */ }
      }
    }
  };

  try {
    watch(path, { persistent: false }, () => flush());
  } catch {
    // Fallback: poll once per second.
    setInterval(flush, 1000).unref();
  }
}
