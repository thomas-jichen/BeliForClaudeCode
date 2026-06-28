import type { Post, Profile as ProfileT } from "../types.ts";
import { renderAvatar } from "./PostCard.tsx";

interface LeaderboardItem {
  rank: number;
  handle: string;
  role: string;
  outputTokens: number;
  avg: string;
  trend: string;
  you?: boolean;
}

const STATIC_LEADERS: LeaderboardItem[] = [
  { rank: 1, handle: "marco_dev", role: "Staff Eng · liquid-ui", outputTokens: 3_240_000, avg: "9.0", trend: "▲ 4" },
  { rank: 2, handle: "priya.codes", role: "Platform · ledger-core", outputTokens: 2_810_000, avg: "8.6", trend: "▲ 1" },
  { rank: 3, handle: "yuki_dev", role: "Creative Technologist", outputTokens: 1_440_000, avg: "8.7", trend: "▲ 2", you: true },
  { rank: 4, handle: "tobias_k", role: "Infra · render-farm", outputTokens: 1_280_000, avg: "7.4", trend: "▼ 1" },
  { rank: 5, handle: "mei.builds", role: "Product · calm-notes", outputTokens: 1_060_000, avg: "8.1", trend: "▲ 3" },
  { rank: 6, handle: "neon_owl", role: "Nights & weekends", outputTokens: 720_000, avg: "6.5", trend: "▼ 2" },
];

function fmtTokensCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function Leaderboard({
  profile,
  posts,
}: {
  profile: ProfileT | null;
  posts: Post[] | null;
}) {
  // Sum user dynamic weekly burn from posts in the database
  const userHandle = profile?.handle || "yuki_dev";
  const userRole = profile?.name || "Creative Technologist";
  
  const userPosts = posts ? posts.filter((p) => p.handle === userHandle && !p.isDraft) : [];
  const userDynamicOutput = userPosts.reduce((acc, p) => acc + (p.stats?.outputTokens ?? 0), 0);
  const userWeeklyOutput = Math.max(1_440_000, userDynamicOutput);

  const leaders = STATIC_LEADERS.map((leader) => {
    if (leader.you) {
      return {
        ...leader,
        handle: userHandle,
        role: userRole,
        outputTokens: userWeeklyOutput,
      };
    }
    return leader;
  }).sort((a, b) => b.outputTokens - a.outputTokens);

  // Rank by sorted output tokens
  leaders.forEach((l, idx) => {
    l.rank = idx + 1;
  });

  return (
    <div className="leaderboard-panel">
      <div className="leaderboard-card">
        <div className="leaderboard-header-row">
          <span className="leaderboard-header-label">Rank · Builder</span>
          <span className="leaderboard-header-label">Output tokens this week</span>
        </div>
        
        {leaders.map((row) => {
          const isUp = row.trend.indexOf("▲") >= 0;
          const isUser = row.handle === userHandle;
          const initials = row.handle.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "AI";
          
          // Generate avatar gradient matching PostCard logic
          let hash = 0;
          for (let i = 0; i < row.handle.length; i++) {
            hash = row.handle.charCodeAt(i) + ((hash << 5) - hash);
          }
          const hue = 24 + (Math.abs(hash) % 26);
          const avatarStyle = {
            background: `linear-gradient(150deg, hsl(${hue},16%,24%), hsl(${hue},18%,13%))`
          };

          return (
            <div 
              key={row.handle} 
              className={`leaderboard-row ${isUser ? "highlighted" : ""}`}
            >
              <div className="leaderboard-row-left">
                <div className={`leaderboard-rank ${row.rank <= 3 ? "top-three" : "other"}`}>
                  {row.rank}
                </div>
                <div className="leaderboard-avatar" style={avatarStyle}>
                  {isUser && profile?.avatar ? (
                    renderAvatar(profile.avatar, row.handle)
                  ) : (
                    initials
                  )}
                </div>
                <div className="leaderboard-user-details">
                  <div className="leaderboard-user-handle">@{row.handle}</div>
                  <div className="leaderboard-user-role">{row.role}</div>
                </div>
              </div>

              <div className="leaderboard-row-right">
                <div className="leaderboard-stats">
                  <div className="leaderboard-tokens">{fmtTokensCompact(row.outputTokens)}</div>
                  <div className="leaderboard-avg">avg {row.avg}</div>
                </div>
                <div className={`leaderboard-trend ${isUp ? "up" : "down"}`}>
                  {row.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
