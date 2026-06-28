import { useEffect, useState } from "react";
import { Feed } from "./components/Feed.tsx";
import { Profile } from "./components/Profile.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { api } from "./api.ts";
import type { Post, Profile as ProfileT } from "./types.ts";
import { renderAvatar } from "./components/PostCard.tsx";

export type Tab = "feed" | "profile" | "leaderboard";
export type Scope = "friends" | "global";

function splitWeeklyTokens(n: number) {
  if (n >= 1_000_000_000) return { main: (n / 1_000_000_000).toFixed(1), unit: "B" };
  if (n >= 1_000_000) return { main: (n / 1_000_000).toFixed(1), unit: "M" };
  if (n >= 1_000) return { main: (n / 1_000).toFixed(1), unit: "k" };
  return { main: String(n), unit: "" };
}

export function App() {
  const [tab, setTabState] = useState<Tab>(() => {
    if (typeof location !== "undefined") {
      const h = location.hash;
      if (h === "#profile") return "profile";
      if (h === "#leaderboard") return "leaderboard";
    }
    return "feed";
  });
  
  const [scope, setScope] = useState<Scope>("friends");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [profile, setProfile] = useState<ProfileT | null>(null);
  
  const loadData = () => {
    api.feed().then(setPosts).catch(() => setPosts([]));
    api.profile().then(setProfile).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  function setTab(t: Tab) {
    setTabState(t);
    if (typeof location !== "undefined") {
      location.hash = t === "feed" ? "" : t;
    }
  }

  // Calculate dynamic weekly metrics for sidebar
  const userHandle = profile?.handle || "yuki_dev";
  const userPostsThisWeek = posts ? posts.filter(p => p.handle === userHandle && !p.isDraft) : [];
  
  const rawWeeklyOutput = userPostsThisWeek.reduce((acc, p) => acc + (p.stats?.outputTokens ?? 0), 0);
  const weeklyOutputVal = rawWeeklyOutput || 1_440_000;
  const weeklySessions = userPostsThisWeek.length || 9;

  const { main: weeklyOutputMain, unit: weeklyOutputUnit } = splitWeeklyTokens(weeklyOutputVal);

  const screenTitle = tab === "feed" ? "Feed" : tab === "profile" ? "Profile" : "Leaderboard";
  const screenSub = tab === "feed"
    ? "Your circle's latest Claude Code sessions"
    : tab === "profile"
    ? "Your sessions, stats, and drafts"
    : "Who burned the most this week";

  return (
    <div className="app-layout" style={{ "--bg-image": "url(/images/japandi_bg.png?v=2)" } as React.CSSProperties}>
      <div className="app-background" />
      <div className="app-overlay" />

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="sidebar">
        <a href="/" className="sidebar-logo" onClick={(e) => { e.preventDefault(); setTab("feed"); }}>
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#FDFBF7" }}>
              {/* Caret: > */}
              <path d="M7 8.5l4 4-4 4" />
              {/* Modern letter P */}
              <path d="M15 7.5v9.5" />
              <path d="M15 7.5c3.5 0, 3.5 4.5, 0 4.5" />
            </svg>
          </div>
          <span className="sidebar-logo-text">Promptly</span>
        </a>

        <div className="sidebar-menu">
          <button 
            className={`sidebar-btn ${tab === "feed" ? "active" : ""}`}
            onClick={() => setTab("feed")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Feed
          </button>
          <button 
            className={`sidebar-btn ${tab === "leaderboard" ? "active" : ""}`}
            onClick={() => setTab("leaderboard")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="20" x2="6" y2="13" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="18" y1="20" x2="18" y2="9" />
            </svg>
            Leaderboard
          </button>
          <button 
            className={`sidebar-btn ${tab === "profile" ? "active" : ""}`}
            onClick={() => setTab("profile")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            Profile
          </button>
        </div>

        {/* Weekly stats widget */}
        <div className="sidebar-widget">
          <div className="sidebar-widget-label">This week</div>
          <div className="sidebar-widget-value">
            {weeklyOutputMain}<span>{weeklyOutputUnit}</span>
          </div>
          <div className="sidebar-widget-sub">
            output tokens · {weeklySessions} session{weeklySessions === 1 ? "" : "s"}
          </div>
        </div>

        {/* User Card at bottom */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {profile?.avatar ? renderAvatar(profile.avatar, userHandle) : "YK"}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-handle">@{userHandle}</div>
            <div className="sidebar-user-status">
              <span className="sidebar-user-status-dot" />
              Coding now
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-area">
        <div className="main-topbar">
          <div className="main-title-container">
            <h2 className="main-title">{screenTitle}</h2>
            <div className="main-subtitle">{screenSub}</div>
          </div>

          {tab === "feed" && (
            <div className="scope-tabs">
              <button 
                className={`scope-btn ${scope === "friends" ? "active" : ""}`}
                onClick={() => setScope("friends")}
              >
                Friends
              </button>
              <button 
                className={`scope-btn ${scope === "global" ? "active" : ""}`}
                onClick={() => setScope("global")}
              >
                Global
              </button>
            </div>
          )}
        </div>

        <div className="scroll-area">
          {tab === "feed" && (
            <Feed 
              posts={posts} 
              profile={profile} 
              scope={scope} 
              onRefresh={loadData} 
            />
          )}
          {tab === "leaderboard" && (
            <Leaderboard 
              profile={profile} 
              posts={posts} 
            />
          )}
          {tab === "profile" && (
            <Profile 
              profile={profile} 
              setProfile={setProfile} 
              posts={posts} 
              onRefresh={loadData} 
            />
          )}
        </div>
      </main>
    </div>
  );
}
