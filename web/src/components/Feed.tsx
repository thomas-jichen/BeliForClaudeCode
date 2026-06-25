import { useEffect, useState } from "react";
import type { Post } from "../types.ts";
import { api } from "../api.ts";
import { PostCard } from "./PostCard.tsx";

export function Feed() {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    api.feed().then(setPosts).catch(() => setPosts([]));
  }, []);

  if (posts === null) {
    return <div className="feed-empty">loading the feed…</div>;
  }
  if (posts.length === 0) {
    return (
      <div className="feed-empty">
        <div className="big">No posts yet 🌱</div>
        Finish a Claude Code session and your card shows up here automatically.
      </div>
    );
  }
  const maxTokensByHandle: Record<string, number> = {};
  if (posts) {
    posts.forEach((p) => {
      const tokens = p.stats?.totalTokens || 0;
      if (!maxTokensByHandle[p.handle] || tokens > maxTokensByHandle[p.handle]) {
        maxTokensByHandle[p.handle] = tokens;
      }
    });
  }

  return (
    <div className="feed">
      {posts.map((p, i) => (
        <PostCard 
          key={p.id} 
          post={p} 
          index={i} 
          isPersonalBest={p.stats?.totalTokens > 0 && p.stats?.totalTokens === maxTokensByHandle[p.handle]}
        />
      ))}
    </div>
  );
}
