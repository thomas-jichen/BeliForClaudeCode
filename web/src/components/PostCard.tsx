import { useState, useEffect } from "react";
import type { Post, Comment } from "../types.ts";
import { api } from "../api.ts";
import { timeAgo, fmtCost, fmtTokens, fmtDuration } from "../format.ts";

interface CulturalReact {
  dbKey: string;
  label: string;
  icon: string;
}

const CULTURAL_REACTIONS: CulturalReact[] = [
  { dbKey: "Ship", label: "Ship", icon: "⚡" },
  { dbKey: "Cooked", label: "Cooked", icon: "😭" },
  { dbKey: "OneShot", label: "One-Shot", icon: "🎯" },
  { dbKey: "CacheGod", label: "Cache God", icon: "🧊" },
  { dbKey: "Forked", label: "Forked", icon: "🍴" },
  { dbKey: "CleanRun", label: "Clean Run", icon: "🟢" },
  { dbKey: "Burned", label: "Burned", icon: "💸" },
  { dbKey: "Refactor", label: "Refactor", icon: "🛠️" },
  { dbKey: "Agentmax", label: "Agentmaxxing", icon: "🤖" },
  { dbKey: "Grass", label: "Touch Grass", icon: "🌱" }
];

const DB_REACTION_MAP: Record<string, string> = {
  "🔥": "Ship",
  "😭": "Cooked",
  "⚡": "OneShot",
  "👑": "CacheGod",
  "🤖": "Agentmax",
  "💀": "Grass",
  "👏": "CleanRun"
};

const REACTION_ICONS: Record<string, React.ReactNode> = {
  Ship: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Cooked: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-.5 0-1 .5-1 1v2c0 .5.5 1 1 1s1-.5 1-1V3c0-.5-.5-1-1-1zM6.3 5.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l1.4 1.4c.4.4 1 .4 1.4 0s.4-1 0-1.4L6.3 5.3zm11.4 0l-1.4 1.4c-.4.4-.4 1 0 1.4s1 .4 1.4 0l1.4-1.4c.4-.4.4-1 0-1.4s-1-.4-1.4 0zM12 7c-2.8 0-5 2.2-5 5v5c0 1.7 1.3 3 3 3h4c1.7 0 3-1.3 3-3v-5c0-2.8-2.2-5-5-5z" />
    </svg>
  ),
  OneShot: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  ),
  CacheGod: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Forked: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M18 15V9a3 3 0 0 0-3-3H9" />
      <line x1="6" y1="8.5" x2="6" y2="15.5" />
    </svg>
  ),
  CleanRun: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="15 10 11 14 9 12" />
    </svg>
  ),
  Burned: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Refactor: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  Agentmax: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
      <line x1="10" y1="1" x2="10" y2="5" />
      <line x1="14" y1="1" x2="14" y2="5" />
      <line x1="10" y1="19" x2="10" y2="23" />
      <line x1="14" y1="19" x2="14" y2="23" />
    </svg>
  ),
  Grass: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22c1.25-6.7 5.85-11.85 12-14M14 8c-3.1 0-7.3 1.9-10 6M14 8c2.9-2.9 6.2-4.9 8-6-1.1 1.8-3.1 5.1-6 8M14 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
    </svg>
  )
};

export function renderAvatar(avatar: string, handle: string) {
  const isUrl = /^(https?:\/\/|\/|data:image)/.test(avatar) || /\.(png|jpe?g|gif|svg|webp)($|\?)/.test(avatar);
  if (isUrl) {
    return <img src={avatar} alt={handle} />;
  }
  
  // Extract initials from clean handle
  const cleanHandle = handle.replace(/[^a-zA-Z0-9]/g, "");
  const initials = cleanHandle.slice(0, 2).toUpperCase() || "AI";
  
  // Choose gradient based on handle name hash
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = handle.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color1 = `hsl(${Math.abs(hash) % 360}, 15%, 22%)`;
  const color2 = `hsl(${(Math.abs(hash) + 120) % 360}, 10%, 12%)`;
  const style = {
    background: `linear-gradient(135deg, ${color1}, ${color2})`
  };
  
  return (
    <div className="avatar-initials" style={style}>
      {initials}
    </div>
  );
}

function fmtModelElite(model: string): string {
  if (!model) return "Sonnet 4";
  const m = model.toLowerCase();
  if (m.includes("opus-4-7")) return "Opus 4.7";
  if (m.includes("opus")) return "Opus 4.7";
  if (m.includes("sonnet-4") || (m.includes("sonnet") && m.includes("4"))) return "Sonnet 4";
  if (m.includes("sonnet")) return "Sonnet 4";
  if (m.includes("gemini-3.5") || (m.includes("gemini") && m.includes("3.5"))) return "Gemini 3.5 Pro";
  if (m.includes("gemini")) return "Gemini 3.5 Pro";
  if (m.includes("deepseek-r1") || m.includes("r1")) return "DeepSeek R1";
  if (m.includes("o3")) return "o3";
  return "Sonnet 4";
}

function getCreditScale(tokens: number) {
  if (tokens >= 100_000_000) return "scale-insane";
  if (tokens >= 10_000_000) return "scale-power";
  if (tokens >= 1_000_000) return "scale-serious";
  if (tokens >= 100_000) return "scale-casual";
  return "scale-tiny";
}

export function PostCard({
  post,
  index = 0,
  onPublish,
  isPersonalBest = false,
}: {
  post: Post;
  index?: number;
  onPublish?: (id: string) => void;
  isPersonalBest?: boolean;
}) {
  const [reactions, setReactions] = useState<Record<string, number>>(() => {
    const raw = post.reactions ?? {};
    const mapped: Record<string, number> = {};
    Object.entries(raw).forEach(([k, v]) => {
      const mappedKey = DB_REACTION_MAP[k] || k;
      mapped[mappedKey] = (mapped[mappedKey] ?? 0) + v;
    });
    return mapped;
  });
  
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [showPalette, setShowPalette] = useState(false);
  const [comments, setComments] = useState<Comment[]>(post.comments ?? []);
  const [newCommentText, setNewCommentText] = useState("");
  const [userProfile, setUserProfile] = useState<{ handle: string; avatar: string } | null>(null);

  useEffect(() => {
    api.profile().then(setUserProfile).catch(() => {});
  }, []);

  async function toggleReact(dbKey: string) {
    const active = myReactions.includes(dbKey);
    setMyReactions(prev => active ? prev.filter(k => k !== dbKey) : [...prev, dbKey]);
    setReactions(prev => ({
      ...prev,
      [dbKey]: Math.max(0, (prev[dbKey] ?? 0) + (active ? -1 : 1))
    }));
    setShowPalette(false);
    
    try {
      const res = await api.react(post.id, dbKey);
      const mapped: Record<string, number> = {};
      Object.entries(res.reactions).forEach(([k, v]) => {
        const mappedKey = DB_REACTION_MAP[k] || k;
        mapped[mappedKey] = (mapped[mappedKey] ?? 0) + v;
      });
      setReactions(prev => ({
        ...prev,
        ...mapped
      }));
    } catch {
      // Keep optimistic values
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    
    const handle = userProfile?.handle || "you";
    const avatar = userProfile?.avatar || "🧑‍💻";
    const text = newCommentText.trim();
    setNewCommentText("");

    const tempId = `temp-${Date.now()}`;
    const tempComment: Comment = {
      id: tempId,
      handle,
      avatar,
      text,
      createdAt: new Date().toISOString()
    };
    setComments(prev => [...prev, tempComment]);

    try {
      const res = await api.addComment(post.id, text, handle, avatar);
      setComments(prev => prev.map(c => c.id === tempId ? res : c));
    } catch {
      // Keep local version optimistic
    }
  }

  const s = post.stats;

  // Build compact flowing stats
  const statParts: string[] = [];
  if (s.costUsd > 0) statParts.push(`${fmtCost(s.costUsd)} spent`);
  if (s.subagents > 0) statParts.push(`${s.subagents} subagent${s.subagents === 1 ? "" : "s"}`);
  if (s.userPrompts > 0) statParts.push(`${s.userPrompts} prompt${s.userPrompts === 1 ? "" : "s"}`);
  if (s.dominantTool) statParts.push(`${s.dominantTool} tool`);
  if (s.filesEdited > 0) statParts.push(`${s.filesEdited} file${s.filesEdited === 1 ? "" : "s"}`);
  if (s.bashCommands > 0) statParts.push(`${s.bashCommands} CLI command${s.bashCommands === 1 ? "" : "s"}`);
  if (s.cacheHitRatio > 0) statParts.push(`${Math.round(s.cacheHitRatio * 100)}% cache`);

  return (
    <article className="card" style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}>
      <div className="card-head">
        <div className="card-head-left">
          <div className="avatar">{renderAvatar(post.avatar, post.handle)}</div>
          <div className="who">
            <div className="handle">@{post.handle}</div>
            <div className="sub">
              <span className="project">{post.project}</span>
              <span className="sep">·</span>
              <span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="card-head-right">
          <span className="duration">{fmtDuration(s.durationMs)}</span>
          <span className="sep">·</span>
          <span className="model">{fmtModelElite(s.primaryModel)}</span>
        </div>
      </div>

      {post.isDraft && (
        <div className="draft-flag">Draft</div>
      )}

      {/* GIANT CENTERPIECE TOKEN DISPLAY */}
      <div className="hero-credits">
        <span className={`value ${getCreditScale(s.totalTokens)}`}>
          {fmtTokens(s.totalTokens)}
          <span className="unit">credits</span>
          {isPersonalBest && (
            <span className="pr-dot" />
          )}
        </span>
      </div>

      {/* COMPACT FLOWING STATS */}
      {statParts.length > 0 && (
        <div className="flowing-stats">
          {statParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < statParts.length - 1 && <span className="sep"> · </span>}
            </span>
          ))}
        </div>
      )}

      {/* SESSION SUMMARY / DESCRIPTION */}
      <div className="card-content-block">
        <h3 className="title">{post.title}</h3>
        {post.review && <p className="review">“{post.review}”</p>}
      </div>

      {/* CUSTOM MONOCHROMATIC MICRO-REACTIONS */}
      <div className="reactions">
        {CULTURAL_REACTIONS.map((r) => {
          const count = reactions[r.dbKey] ?? 0;
          if (count === 0) return null;
          const active = myReactions.includes(r.dbKey);
          return (
            <button 
              key={r.dbKey}
              className={`react-btn ${active ? "active" : ""}`}
              onClick={() => toggleReact(r.dbKey)}
              title={r.label}
            >
              {REACTION_ICONS[r.dbKey]}
              <span>{count}</span>
            </button>
          );
        })}

        {/* Reaction Popover container */}
        <div className="react-palette-container">
          <button className="react-btn add-react" onClick={() => setShowPalette((v) => !v)}>
            ＋
          </button>
          {showPalette && (
            <div className="react-palette">
              {CULTURAL_REACTIONS.map((r) => {
                const active = myReactions.includes(r.dbKey);
                return (
                  <button 
                    key={r.dbKey} 
                    onClick={() => toggleReact(r.dbKey)}
                    className={active ? "active" : ""}
                    title={r.label}
                  >
                    {REACTION_ICONS[r.dbKey]}
                    <span>{r.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {post.isDraft && onPublish && (
          <button className="publish-btn" style={{ marginLeft: "auto" }} onClick={() => onPublish(post.id)}>
            Publish
          </button>
        )}
      </div>

      {/* Social threads comments */}
      <div className="comments-section">
        {comments.length > 0 && (
          <div className="comments-list">
            {comments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <div className="comment-avatar">
                  {renderAvatar(comment.avatar, comment.handle)}
                </div>
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-handle">@{comment.handle}</span>
                    <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <div className="comment-text">{comment.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="comment-input-form" onSubmit={handleCommentSubmit}>
          <div className="comment-avatar">
            {renderAvatar(userProfile?.avatar || "you", userProfile?.handle || "you")}
          </div>
          <div className="comment-input-container">
            <input
              type="text"
              className="input"
              placeholder="Add a comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className={`comment-post-btn ${newCommentText.trim() ? "show" : ""}`}
          >
            Post
          </button>
        </form>
      </div>
    </article>
  );
}
