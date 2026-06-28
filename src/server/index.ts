import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  load,
  getProfile,
  setProfile,
  addPost,
  listFeed,
  listDrafts,
  publishPost,
  deletePost,
  reactToPost,
  addCommentToPost,
  ingestOutbox,
  seedIfEmpty,
} from "./db.ts";
import { seedPosts } from "./seed.ts";
import { tailToStdout } from "./tail.ts";
import { writeConfig } from "../hook/config.ts";
import { DEFAULT_PORT, WORKER_LOG } from "../shared/paths.ts";
import type { Post } from "../shared/post.ts";

const WEB_DIST = join(import.meta.dirname, "../../web/dist");

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/feed", (_req, res) => {
    res.json({ posts: listFeed() });
  });

  app.get("/api/drafts", (_req, res) => {
    res.json({ posts: listDrafts() });
  });

  app.get("/api/profile", (_req, res) => {
    res.json(getProfile());
  });

  app.put("/api/profile", (req, res) => {
    const { handle, avatar, autoShareMinTokens, name } = req.body ?? {};
    const next: Record<string, unknown> = {};
    if (typeof handle === "string" && handle.trim()) next.handle = handle.trim().replace(/\s+/g, "").slice(0, 30);
    if (typeof avatar === "string" && avatar.trim()) next.avatar = avatar.trim().slice(0, 500);
    if (typeof name === "string") next.name = name.trim().slice(0, 50);
    if (typeof autoShareMinTokens === "number" && autoShareMinTokens >= 0) {
      next.autoShareMinTokens = Math.round(autoShareMinTokens);
    }
    const profile = setProfile(next);
    // keep the hook's local config in sync so the threshold takes effect immediately
    writeConfig({
      handle: profile.handle,
      avatar: profile.avatar,
      autoShareMinTokens: profile.autoShareMinTokens,
    });
    res.json(profile);
  });

  app.post("/api/posts", (req, res) => {
    const body = req.body as Post;
    if (!body || typeof body.handle !== "string" || !body.stats) {
      res.status(400).json({ error: "invalid post" });
      return;
    }
    if (typeof body.createdAt !== "string" || !body.createdAt) {
      res.status(400).json({ error: "createdAt (session end time) required" });
      return;
    }
    const post = addPost(body);
    res.status(201).json(post);
  });

  app.delete("/api/posts/:id", (req, res) => {
    const ok = deletePost(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(204).end();
  });

  app.post("/api/posts/:id/publish", (req, res) => {
    const post = publishPost(req.params.id);
    if (!post) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(post);
  });

  app.post("/api/posts/:id/react", (req, res) => {
    const emoji = (req.body?.emoji ?? "").toString().slice(0, 8);
    if (!emoji) {
      res.status(400).json({ error: "emoji required" });
      return;
    }
    // delta = +1 to add, -1 to remove (toggle off). Anything else falls back to +1.
    const rawDelta = Number(req.body?.delta);
    const delta = rawDelta === -1 ? -1 : 1;
    const reactions = reactToPost(req.params.id, emoji, delta);
    if (!reactions) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ reactions });
  });

  app.post("/api/posts/:id/comments", (req, res) => {
    const { text, handle, avatar } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "comment text required" });
      return;
    }
    const comment = addCommentToPost(req.params.id, {
      handle: (handle || "anonymous").trim().slice(0, 30),
      avatar: (avatar || "🧑‍💻").trim().slice(0, 500),
      text: text.trim().slice(0, 1000)
    });
    if (!comment) {
      res.status(404).json({ error: "post not found" });
      return;
    }
    res.status(201).json(comment);
  });

  // Static web UI (built by Vite). SPA fallback to index.html.
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, {
      etag: false,
      maxAge: 0,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(join(WEB_DIST, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send("<h1>Promptly API is running</h1><p>Web UI not built yet. Run <code>npm run build:web</code>.</p>");
    });
  }

  return app;
}

export function startServer(port = DEFAULT_PORT): Promise<void> {
  return new Promise((resolve) => {
    load();
    const ingested = ingestOutbox();
    seedIfEmpty(seedPosts());
    const app = createApp();
    app.listen(port, () => {
      if (ingested > 0) console.log(`📥 ingested ${ingested} queued post(s) from outbox`);
      console.log(`\n  🟢 Promptly running → http://localhost:${port}`);
      console.log(`  📜 streaming worker log (${WORKER_LOG}) — every session end will print here:\n`);
      tailToStdout(WORKER_LOG);
      resolve();
    });
  });
}

// Run directly: `node src/server/index.ts`
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("index.ts");
if (invokedDirectly) {
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
