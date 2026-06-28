import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DATA_FILE, OUTBOX_DIR, ensureDirs } from "../shared/paths.ts";
import type { Post, Comment } from "../shared/post.ts";

export interface Profile {
  handle: string;
  name?: string;
  avatar: string;
  autoShareMinTokens: number;
}

interface Store {
  profile: Profile;
  posts: Post[];
}

const DEFAULT_PROFILE: Profile = { handle: "you", name: "Creative Technologist", avatar: "YO", autoShareMinTokens: 5_000 };

let store: Store = { profile: { ...DEFAULT_PROFILE }, posts: [] };

export function load(): void {
  ensureDirs();
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    store = {
      profile: { ...DEFAULT_PROFILE, ...(raw.profile ?? {}) },
      posts: Array.isArray(raw.posts) ? raw.posts : [],
    };
  } catch {
    store = { profile: { ...DEFAULT_PROFILE }, posts: [] };
  }
}

function persist(): void {
  ensureDirs();
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

export function getProfile(): Profile {
  return store.profile;
}

export function setProfile(p: Partial<Profile>): Profile {
  store.profile = { ...store.profile, ...p };
  persist();
  return store.profile;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Insert a post. Server owns ONLY id and postedAt — session truth (createdAt, stats, model)
// is passed through untouched. This is what guarantees a session from weeks ago doesn't
// suddenly read as "<1m ago" just because the outbox got drained today.
export function addPost(input: Post): Post {
  const now = new Date().toISOString();
  const post: Post = {
    ...input,
    id: uid(),
    postedAt: now,
    reactions: input.reactions ?? {},
    comments: input.comments ?? [],
  };
  store.posts.unshift(post);
  persist();
  return post;
}

// Sort order: most-recent "moment that put it in front of you" first. For published posts
// that's publishedAt; otherwise the session's own createdAt. Never lie about createdAt itself.
function feedTime(p: Post): number {
  return +new Date(p.publishedAt ?? p.postedAt ?? p.createdAt);
}

export function listFeed(): Post[] {
  return store.posts
    .filter((p) => !p.isDraft)
    .sort((a, b) => feedTime(b) - feedTime(a));
}

export function listDrafts(): Post[] {
  return store.posts
    .filter((p) => p.isDraft)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getPost(id: string): Post | undefined {
  return store.posts.find((p) => p.id === id);
}

export function publishPost(id: string): Post | undefined {
  const p = getPost(id);
  if (!p) return undefined;
  p.isDraft = false;
  p.publishedAt = new Date().toISOString(); // surface at top of feed, but never rewrite createdAt
  persist();
  return p;
}

export function deletePost(id: string): boolean {
  const before = store.posts.length;
  store.posts = store.posts.filter((p) => p.id !== id);
  if (store.posts.length === before) return false;
  persist();
  return true;
}

export function reactToPost(
  id: string,
  emoji: string,
  delta: number = 1,
): Record<string, number> | undefined {
  const p = getPost(id);
  if (!p) return undefined;
  const next = Math.max(0, (p.reactions[emoji] ?? 0) + delta);
  if (next === 0) delete p.reactions[emoji];
  else p.reactions[emoji] = next;
  persist();
  return p.reactions;
}

export function addCommentToPost(
  postId: string,
  comment: { handle: string; avatar: string; text: string }
): Comment | undefined {
  const p = getPost(postId);
  if (!p) return undefined;
  if (!p.comments) {
    p.comments = [];
  }
  const newComment: Comment = {
    id: uid(),
    handle: comment.handle,
    avatar: comment.avatar,
    text: comment.text,
    createdAt: new Date().toISOString(),
  };
  p.comments.push(newComment);
  persist();
  return newComment;
}

export function hasPosts(): boolean {
  return store.posts.length > 0;
}

export function seedIfEmpty(posts: Post[]): void {
  if (store.posts.length === 0) {
    store.posts = posts;
    persist();
  }
}

// Drain any posts queued by the hook while the server was offline.
export function ingestOutbox(): number {
  ensureDirs();
  let count = 0;
  let files: string[] = [];
  try {
    files = readdirSync(OUTBOX_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return 0;
  }
  for (const f of files) {
    const full = join(OUTBOX_DIR, f);
    try {
      const post = JSON.parse(readFileSync(full, "utf8")) as Post;
      addPost(post);
      count++;
    } catch {
      // ignore malformed
    }
    try {
      rmSync(full);
    } catch {
      /* ignore */
    }
  }
  return count;
}
