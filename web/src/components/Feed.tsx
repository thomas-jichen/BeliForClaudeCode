import type { Post, Profile } from "../types.ts";
import { PostCard } from "./PostCard.tsx";

const FRIENDS_HANDLES = new Set(["vivan", "priya", "marco_dev", "neon_owl", "priya.codes"]);

export function Feed({
  posts,
  profile,
  scope,
  onRefresh,
}: {
  posts: Post[] | null;
  profile: Profile | null;
  scope: "friends" | "global";
  onRefresh: () => void;
}) {
  if (posts === null) {
    return <div className="feed-empty">loading the feed…</div>;
  }

  const userHandle = profile?.handle || "yuki_dev";
  
  // Filter out drafts from the main feed! Drafts are only shown on the Profile tab.
  const activePosts = posts.filter(p => !p.isDraft);

  const filteredPosts = activePosts.filter((p) => {
    if (scope === "friends") {
      return p.handle === userHandle || FRIENDS_HANDLES.has(p.handle);
    }
    return true; // Global shows all active posts
  });

  if (filteredPosts.length === 0) {
    return (
      <div className="feed-empty">
        <div className="big">No posts yet 🌱</div>
        {scope === "friends" 
          ? "None of your friends have shared sessions recently. Check the Global tab!" 
          : "Finish a Claude Code session and your card shows up here automatically."
        }
      </div>
    );
  }

  const maxTokensByHandle: Record<string, number> = {};
  posts.forEach((p) => {
    const tokens = p.stats?.totalTokens || 0;
    if (!maxTokensByHandle[p.handle] || tokens > maxTokensByHandle[p.handle]) {
      maxTokensByHandle[p.handle] = tokens;
    }
  });

  return (
    <div className="feed">
      {filteredPosts.map((p, i) => (
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
