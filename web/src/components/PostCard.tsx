import { useState, useEffect } from "react";
import type { Post, Comment } from "../types.ts";
import { api } from "../api.ts";
import { timeAgo, fmtCost, fmtDuration } from "../format.ts";

interface CulturalReact {
  dbKey: string;
  label: string;
  color: string;
}

const CULTURAL_REACTIONS: CulturalReact[] = [
  { dbKey: "Ship", label: "Ship", color: "#C2542E" },
  { dbKey: "Cooked", label: "Cooked", color: "#B5654A" },
  { dbKey: "OneShot", label: "One-Shot", color: "#7E9079" },
  { dbKey: "CacheGod", label: "Cache God", color: "#9A8F7C" },
  { dbKey: "Forked", label: "Forked", color: "#8A8175" },
  { dbKey: "CleanRun", label: "Clean Run", color: "#7E9079" },
  { dbKey: "Burned", label: "Burned", color: "#D97757" },
  { dbKey: "Refactor", label: "Refactor", color: "#9A8F7C" },
  { dbKey: "Agentmax", label: "Agentmaxxing", color: "#B5654A" },
  { dbKey: "Grass", label: "Touch Grass", color: "#7E9079" }
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
  const hue = 24 + (Math.abs(hash) % 26);
  const style = {
    background: `linear-gradient(150deg, hsl(${hue},16%,24%), hsl(${hue},18%,13%))`
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

function splitTokens(n: number) {
  if (n >= 1_000_000_000) return { main: (n / 1_000_000_000).toFixed(1), unit: "B" };
  if (n >= 1_000_000) return { main: (n / 1_000_000).toFixed(1), unit: "M" };
  if (n >= 1_000) return { main: (n / 1_000).toFixed(1), unit: "k" };
  return { main: String(n), unit: "" };
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

  const { main, unit } = splitTokens(s.totalTokens);

  const score = post.score ?? 0;
  const scoreBg = score >= 7
    ? "linear-gradient(150deg, rgba(217,119,87,0.96), rgba(194,84,46,0.96))"
    : score >= 5
    ? "linear-gradient(150deg, rgba(184,150,110,0.96), rgba(150,118,84,0.96))"
    : "linear-gradient(150deg, rgba(150,143,124,0.95), rgba(110,103,90,0.95))";

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
          <span>{s.durationMs ? fmtDuration(s.durationMs) : "0m"}</span>
          <br />
          <span>{fmtModelElite(s.primaryModel)}</span>
        </div>
      </div>

      {post.isDraft && (
        <div className="draft-flag">Draft</div>
      )}

      {/* GIANT CENTERPIECE TOKEN DISPLAY */}
      <div className="hero-credits">
        <div className="value">
          {main}
          <span className="unit">{unit}</span>
        </div>
        <div className="credits-label-container">
          <span className="credits-label">credits burned</span>
          {isPersonalBest && <span className="pr-dot" />}
        </div>
      </div>

      {/* COMPACT FLOWING STATS */}
      {statParts.length > 0 && (
        <div className="flowing-stats">
          {statParts.map((part, i) => (
            <span key={i}>
              <span>{part}</span>
              {i < statParts.length - 1 && <span className="sep"> · </span>}
            </span>
          ))}
        </div>
      )}

      {/* UNIFIED STORY / SUMMARY & ROAST */}
      <div className="session-story">
        <span className="session-title">{post.title}</span>
        {post.review && <span className="session-roast"> — {post.review}</span>}
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
              <span className="react-dot" style={{ backgroundColor: r.color }} />
              <span>{r.label} {count}</span>
            </button>
          );
        })}

        {/* Reaction Popover container */}
        <div className="react-palette-container">
          <button className="react-btn add-react" onClick={() => setShowPalette((v) => !v)}>
            +
          </button>
          {showPalette && (
            <div className="react-palette">
              {CULTURAL_REACTIONS.map((r) => {
                const active = myReactions.includes(r.dbKey);
                return (
                  <button 
                    key={r.dbKey} 
                    onClick={() => toggleReact(r.dbKey)}
                    className={`react-palette-btn ${active ? "active" : ""}`}
                    title={r.label}
                  >
                    <span className="react-dot" style={{ backgroundColor: r.color }} />
                    <span>{r.label}</span>
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

        <div className="score-badge" style={{ background: scoreBg, marginLeft: post.isDraft ? "12px" : "auto" }}>
          <span>{score.toFixed(1)}</span>
        </div>
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
          <input
            type="text"
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
          />
          <button 
            type="submit" 
            className="comment-post-btn"
            style={{
              border: "none",
              color: newCommentText.trim() ? "#ffffff" : "var(--text-light)",
              background: newCommentText.trim() ? "linear-gradient(150deg, var(--accent-orange-hover), var(--accent-orange))" : "rgba(0,0,0,0.05)",
              pointerEvents: newCommentText.trim() ? "auto" : "none"
            }}
          >
            Post
          </button>
        </form>
      </div>
    </article>
  );
}
