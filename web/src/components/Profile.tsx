import { useEffect, useState, useRef } from "react";
import type { Post, Profile as ProfileT } from "../types.ts";
import { api } from "../api.ts";
import { PostCard, renderAvatar } from "./PostCard.tsx";
import { fmtTokens } from "../format.ts";

const PRESETS = [
  { label: "Everything", value: 0 },
  { label: "100k+", value: 100_000 },
  { label: "1M+", value: 1_000_000 },
  { label: "10M+", value: 10_000_000 },
  { label: "50M+", value: 50_000_000 },
];

export function Profile() {
  const [profile, setProfile] = useState<ProfileT | null>(null);
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
    api.profile().then((p) => {
      setProfile(p);
      setHandle(p.handle);
      setAvatar(p.avatar);
      setThreshold(p.autoShareMinTokens);
      setTempName(p.name || "Creative Technologist");
      setTempHandle(p.handle);
      setTempAvatar(p.avatar);
    });
    api.drafts().then(setDrafts).catch(() => setDrafts([]));
  }, []);

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
    }
  };

  const publish = async (id: string) => {
    await api.publish(id);
    setDrafts((d) => d.filter((p) => p.id !== id));
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

  const totalDraftsTokens = drafts.reduce((acc, p) => acc + (p.stats?.totalTokens || 0), 0);
  const totalBurned = 124_800_000 + totalDraftsTokens;

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
    <>
      <div className="panel">
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
          </div>
        </div>

        {/* Apple Fitness / Strava style Athlete summaries */}
        <div className="profile-stats-row">
          <div className="profile-stat">
            <span className="label">Total Burn</span>
            <span className="value">{fmtTokens(totalBurned)}</span>
          </div>
          <div className="profile-stat">
            <span className="label">Active Streak</span>
            <span className="value">14 days</span>
          </div>
          <div className="profile-stat">
            <span className="label">Top Model</span>
            <span className="value">Sonnet 4</span>
          </div>
          <div className="profile-stat">
            <span className="label">Shipping Rate</span>
            <span className="value">4.2/wk</span>
          </div>
        </div>

        {/* Shipping Activity Heatmap Graph */}
        <div className="heatmap-container">
          <div className="heatmap-title">Shipping Intensity</div>
          <svg viewBox="0 0 470 96" width="100%" height="86" style={{ overflow: "visible" }}>
            {heatmapDots.map((dot, i) => {
              let fill = "rgba(255, 255, 255, 0.03)";
              if (dot.level === 1) fill = "rgba(255, 255, 255, 0.12)";
              if (dot.level === 2) fill = "rgba(255, 255, 255, 0.35)";
              if (dot.level === 3) fill = "rgba(255, 255, 255, 0.65)";
              if (dot.level === 4) fill = "var(--accent)";

              const x = dot.c * 19 + 8;
              const y = dot.r * 18 + 8;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="5.5"
                  fill={fill}
                />
              );
            })}
          </svg>
        </div>

        {/* Auto-share threshold config section */}
        <div className="field presets-container">
          <label>Auto-share threshold</label>
          <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <input
              type="number"
              min={0}
              step={100000}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
              onBlur={() => handleSaveThreshold(threshold)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveThreshold(threshold);
                }
              }}
              style={{ maxWidth: 140 }}
            />
            <div className="tabs">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  className={`tab ${threshold === p.value ? "active" : ""}`}
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
          <div className="hint">
            {threshold === 0 ? (
              <>Every session auto-posts to the feed.</>
            ) : (
              <>
                Only sessions above{" "}
                <span className="threshold-readout">{fmtTokens(threshold)} tokens</span> auto-post.
                Smaller ones are saved as drafts you can publish below.
              </>
            )}
          </div>
        </div>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="section-title">Drafts · {drafts.length}</div>
          <div className="feed">
            {(() => {
              const maxDraftTokens = drafts.reduce((max, p) => Math.max(max, p.stats?.totalTokens || 0), 0);
              return drafts.map((p, i) => (
                <PostCard 
                  key={p.id} 
                  post={p} 
                  index={i} 
                  onPublish={publish} 
                  isPersonalBest={p.stats?.totalTokens > 0 && p.stats?.totalTokens === maxDraftTokens}
                />
              ));
            })()}
          </div>
        </>
      )}
    </>
  );
}
