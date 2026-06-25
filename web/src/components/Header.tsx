import type { Tab } from "../App.tsx";

export function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header className="header">
      <div className="logo">
        promptly<span className="dot">.</span>
      </div>
      <nav className="tabs">
        <button className={`tab ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")}>
          Feed
        </button>
        <button className={`tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          Profile
        </button>
      </nav>
    </header>
  );
}
