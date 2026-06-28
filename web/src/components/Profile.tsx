import { useEffect, useState, useRef } from "react";
import type { Post, Profile as ProfileT } from "../types.ts";
import { api } from "../api.ts";
import { PostCard, renderAvatar } from "./PostCard.tsx";
import { fmtCost, fmtDuration, fmtTokens } from "../format.ts";

// Thresholds gate on OUTPUT tokens (what Claude actually generated this slice). Output
// is the headline metric on the card, so it's also the natural scale here.
const PRESETS = [
  { label: "Everything", value: 0 },
  { label: "5k+", value: 5_000 },
  { label: "20k+", value: 20_000 },
  { label: "50k+", value: 50_000 },
  { label: "200k+", value: 200_000 },
];

const ACHIEVEMENTS = [
  { label: "Token Tycoon", dot: "#D97757" },
  { label: "Subagent Whisperer", dot: "#A89A86" },
  { label: "Marathoner", dot: "#7E9079" },
  { label: "Night Owl", dot: "#9A8F7C" },
  { label: "Cache Freeloader", dot: "#B5654A" },
  { label: "The Closer", dot: "#C2542E" },
];

export function Profile({
  profile,
  setProfile,
  posts,
  onRefresh,
}: {
  profile: ProfileT | null;
  setProfile: (p: ProfileT) => void;
  posts: Post[] | null;
  onRefresh: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [avatar, setAvatar] = useState("");
  const [threshold, setThreshold] = useState(1_000_000);
  const [saved, setSaved] = useState(false);
  const [drafts, setDrafts] = useState<Post[]>([]);

  // Inline editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [tempHandle, setTempHandle] = useState("");

  const [showAvatarEdit, setShowAvatarEdit] = useState(false);
  const [tempAvatar, setTempAvatar] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      setHandle(profile.handle);
      setAvatar(profile.avatar);
      setThreshold(profile.autoShareMinTokens);
      setTempName(profile.name || "Creative Technologist");
      setTempHandle(profile.handle);
      setTempAvatar(profile.avatar);
    }
    api.drafts().then(setDrafts).catch(() => setDrafts([]));
  }, [profile]);

  // Autofocus effects
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingHandle && handleInputRef.current) {
      handleInputRef.current.focus();
      handleInputRef.current.select();
    }
  }, [isEditingHandle]);

  useEffect(() => {
    if (showAvatarEdit && avatarInputRef.current) {
      avatarInputRef.current.focus();
      avatarInputRef.current.select();
    }
  }, [showAvatarEdit]);

  // Click outside to autosave avatar popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const currentTarget = event.target as HTMLElement;
        if (currentTarget.closest(".avatar-large")) {
          return;
        }
        handleSaveAvatar();
      }
    }
    if (showAvatarEdit) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAvatarEdit, tempAvatar, profile]);

  const showSavedIndicator = () => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  };

  const handleSaveName = async () => {
    if (!profile) return;
    const finalName = tempName.trim() || "Creative Technologist";
    if (finalName !== (profile.name || "Creative Technologist")) {
      const updated = await api.saveProfile({ name: finalName });
      setProfile(updated);
      setTempName(updated.name || "Creative Technologist");
      showSavedIndicator();
      onRefresh();
    }
    setIsEditingName(false);
  };

  const handleSaveHandle = async () => {
    if (!profile) return;
    const finalHandle = tempHandle.trim().replace(/\s+/g, "");
    if (!finalHandle) {
      setTempHandle(profile.handle);
      setIsEditingHandle(false);
      return;
    }
    if (finalHandle !== profile.handle) {
      const updated = await api.saveProfile({ handle: finalHandle });
      setProfile(updated);
      setHandle(updated.handle);
      setTempHandle(updated.handle);
      showSavedIndicator();
      onRefresh();
    }
    setIsEditingHandle(false);
  };

  const handleSaveAvatar = async () => {
    if (!profile) return;
    const finalAvatar = tempAvatar.trim();
    if (finalAvatar !== profile.avatar) {
      const updated = await api.saveProfile({ avatar: finalAvatar });
      setProfile(updated);
      setAvatar(updated.avatar);
      setTempAvatar(updated.avatar);
      showSavedIndicator();
      onRefresh();
    }
    setShowAvatarEdit(false);
  };

  const handleSaveThreshold = async (val: number) => {
    if (!profile) return;
    if (val !== profile.autoShareMinTokens) {
      const updated = await api.saveProfile({ autoShareMinTokens: val });
      setProfile(updated);
      setThreshold(updated.autoShareMinTokens);
      showSavedIndicator();
      onRefresh();
    }
  };

  const publish = async (id: string) => {
    await api.publish(id);
    setDrafts((d) => d.filter((p) => p.id !== id));
    onRefresh();
  };

  const deletePost = async (id: string) => {
    try {
      await api.deletePost(id);
    } catch {
      /* fall through to refresh anyway */
    }
    setDrafts((d) => d.filter((p) => p.id !== id));
    onRefresh();
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setTempName(profile?.name || "Creative Technologist");
      setIsEditingName(false);
    }
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveHandle();
    } else if (e.key === "Escape") {
      setTempHandle(profile?.handle || "");
      setIsEditingHandle(false);
    }
  };

  const handleAvatarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveAvatar();
    } else if (e.key === "Escape") {
      setTempAvatar(profile?.avatar || "");
      setShowAvatarEdit(false);
    }
  };

  if (!profile) return <div className="feed-empty">loading…</div>;

  // Calculate dynamic summary metrics based on posts
  const userPosts = posts ? posts.filter((p) => p.handle === profile.handle && !p.isDraft) : [];
  
  // Total Output: base seed + dynamic posts. Sums output tokens specifically (the
  // headline metric on each card).
  const totalDraftsOutput = drafts.reduce((acc, p) => acc + (p.stats?.outputTokens ?? 0), 0);
  const userDynamicOutput = userPosts.reduce((acc, p) => acc + (p.stats?.outputTokens ?? 0), 0);
  const totalOutput = 4_800_000 + userDynamicOutput + totalDraftsOutput;

  // Average score
  const totalScore = userPosts.reduce((acc, p) => acc + (p.score || 0), 0);
  const avgScore = userPosts.length > 0 ? (totalScore / userPosts.length).toFixed(1) : "8.7";

  const heatmapDots = [];
  const cols = 24;
  const rows = 5;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const seedVal = (c * 7 + r * 3) % 11;
      let level = 0;
      if (seedVal > 8) level = 3;
      else if (seedVal > 5) level = 2;
      else if (seedVal > 2) level = 1;
      if ((c === 22 && r === 2) || (c === 18 && r === 4) || (c === 10 && r === 1)) {
        level = 4;
      }
      heatmapDots.push({ c, r, level });
    }
  }

  return (
    <div className="profile-panel">
      <div className="profile-card">
        {/* Creative Technologist Profile Header */}
        <div className="profile-header">
          <div className="avatar-large-wrapper">
            <div
              className="avatar avatar-large"
              onClick={() => setShowAvatarEdit(!showAvatarEdit)}
              title="Click to edit photo or initials"
            >
              {renderAvatar(avatar, handle)}
            </div>

            {showAvatarEdit && (
              <div className="avatar-edit-popover" ref={popoverRef}>
                <input
                  ref={avatarInputRef}
                  type="text"
                  className="popover-input"
                  placeholder="Paste photo URL, or initials (e.g. YO)"
                  value={tempAvatar}
                  onChange={(e) => setTempAvatar(e.target.value)}
                  onKeyDown={handleAvatarKeyDown}
                />
                <div className="popover-actions">
                  <button
                    className="popover-btn cancel"
                    onClick={() => {
                      setTempAvatar(profile?.avatar || "");
                      setShowAvatarEdit(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="popover-btn" onClick={handleSaveAvatar}>
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="profile-meta">
            <div className="profile-name-row">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  className="profile-name-input"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={handleNameKeyDown}
                  maxLength={50}
                />
              ) : (
                <h1 onClick={() => setIsEditingName(true)} title="Click to edit name">
                  {profile.name || "Creative Technologist"}
                </h1>
              )}
              <span className={`saved-note ${saved ? "show" : ""}`}>✓ saved</span>
            </div>

            <div className="profile-meta-sub">
              {isEditingHandle ? (
                <div className="profile-handle-edit-wrapper">
                  <span className="handle-at">@</span>
                  <input
                    ref={handleInputRef}
                    type="text"
                    className="profile-handle-input"
                    value={tempHandle}
                    onChange={(e) => setTempHandle(e.target.value.replace(/\s+/g, ""))}
                    onBlur={handleSaveHandle}
                    onKeyDown={handleHandleKeyDown}
                    maxLength={30}
                  />
                </div>
              ) : (
                <span
                  className="handle-tag"
                  onClick={() => setIsEditingHandle(true)}
                  title="Click to edit handle"
                >
                  @{handle}
                </span>
              )}
              <span className="profile-role-sep">·</span>
              <span className="profile-role">Creative Technologist</span>
            </div>
          </div>
        </div>

        {/* Athlete summaries */}
        <div className="profile-stats-row">
          <div className="profile-stat">
            <span className="profile-stat-value">{fmtTokens(totalOutput)}</span>
            <span className="profile-stat-label">Total Output</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">14<span>d</span></span>
            <span className="profile-stat-label">Streak</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value" style={{ color: "var(--accent-orange)" }}>{avgScore}</span>
            <span className="profile-stat-label">Avg Score</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">4.2<span>/wk</span></span>
            <span className="profile-stat-label">Ship Rate</span>
          </div>
        </div>

        {/* CSS Grid Heatmap */}
        <div className="heatmap-container">
          <div className="heatmap-header">
            <div className="heatmap-title">Shipping Intensity</div>
            <div className="heatmap-subtitle">last 24 weeks</div>
          </div>
          <div className="heatmap-grid">
            {heatmapDots.map((dot, i) => {
              let fill = "rgba(0, 0, 0, 0.04)";
              if (dot.level === 1) fill = "rgba(217, 119, 87, 0.26)";
              if (dot.level === 2) fill = "rgba(217, 119, 87, 0.5)";
              if (dot.level === 3) fill = "rgba(217, 119, 87, 0.82)";
              if (dot.level === 4) fill = "rgba(194, 84, 46, 0.92)";

              return (
                <div 
                  key={i} 
                  className="heatmap-cell" 
                  style={{ backgroundColor: fill }} 
                  title={`Level ${dot.level}`}
                />
              );
            })}
          </div>
        </div>

        {/* Achievements list */}
        <div className="achievements-container">
          <div className="achievements-title">Achievements</div>
          <div className="badges-list">
            {ACHIEVEMENTS.map((b) => (
              <div className="badge-item" key={b.label}>
                <span className="badge-dot" style={{ backgroundColor: b.dot }} />
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Auto-share threshold config section */}
        <div className="presets-field">
          <label>Auto-share threshold</label>
          <div className="presets-row">
            <input
              type="number"
              min={0}
              step={100000}
              className="presets-input"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
              onBlur={() => handleSaveThreshold(threshold)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveThreshold(threshold);
                }
              }}
            />
            <div className="presets-tabs">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  className={`presets-tab-btn ${threshold === p.value ? "active" : ""}`}
                  onClick={() => {
                    setThreshold(p.value);
                    handleSaveThreshold(p.value);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="presets-hint">
            {threshold === 0 ? (
              <>Every session auto-posts to the feed.</>
            ) : (
              <>
                Only sessions above{" "}
                <span className="threshold-readout">{fmtTokens(threshold)} output tokens</span> auto-post.
                Smaller ones are saved as drafts you can publish below.
              </>
            )}
          </div>
        </div>
      </div>

      {/* User's own active sessions */}
      {userPosts.length > 0 && (
        <div>
          <div className="profile-sessions-header">Your sessions</div>
          <div className="feed">
            {userPosts.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                index={i}
                onDelete={deletePost}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <>
          <div className="section-title">Drafts · {drafts.length}</div>
          <div className="feed">
            {drafts.map((p, i) => (
              <div key={p.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "0 4px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--text-light)" }}></span>
                    Draft · below your auto-share threshold
                  </span>
                  <button className="publish-btn" onClick={() => publish(p.id)}>Publish</button>
                </div>
                <PostCard
                  post={p}
                  index={i}
                  onDelete={deletePost}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
