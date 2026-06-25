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

const DEFAULT_PROFILE: Profile = { handle: "you", name: "Creative Technologist", avatar: "YO", autoShareMinTokens: 1_000_000 };

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

// Insert a post. Server is the source of truth for id / createdAt / reactions.
export function addPost(input: Post): Post {
  const post: Post = {
    ...input,
    id: uid(),
    createdAt: new Date().toISOString(),
    reactions: {},
  };
  store.posts.unshift(post);
  persist();
  return post;
}

export function listFeed(): Post[] {
  return store.posts
    .filter((p) => !p.isDraft)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
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
  p.createdAt = new Date().toISOString(); // surface at top of feed when published
  persist();
  return p;
}

export function reactToPost(id: string, emoji: string): Record<string, number> | undefined {
  const p = getPost(id);
  if (!p) return undefined;
  p.reactions[emoji] = (p.reactions[emoji] ?? 0) + 1;
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
