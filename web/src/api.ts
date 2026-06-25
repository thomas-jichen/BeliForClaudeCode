import type { Post, Profile, Comment } from "./types.ts";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  feed: () => fetch("/api/feed").then((r) => j<{ posts: Post[] }>(r)).then((d) => d.posts),
  drafts: () => fetch("/api/drafts").then((r) => j<{ posts: Post[] }>(r)).then((d) => d.posts),
  profile: () => fetch("/api/profile").then((r) => j<Profile>(r)),
  saveProfile: (p: Partial<Profile>) =>
    fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    }).then((r) => j<Profile>(r)),
  react: (id: string, emoji: string) =>
    fetch(`/api/posts/${id}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).then((r) => j<{ reactions: Record<string, number> }>(r)),
  publish: (id: string) =>
    fetch(`/api/posts/${id}/publish`, { method: "POST" }).then((r) => j<Post>(r)),
  addComment: (id: string, text: string, handle: string, avatar: string) =>
    fetch(`/api/posts/${id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, handle, avatar }),
    }).then((r) => j<Comment>(r)),
};
