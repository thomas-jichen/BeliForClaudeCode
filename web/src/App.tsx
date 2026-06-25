import { useState } from "react";
import { Header } from "./components/Header.tsx";
import { Feed } from "./components/Feed.tsx";
import { Profile } from "./components/Profile.tsx";

export type Tab = "feed" | "profile";

export function App() {
  const [tab, setTabState] = useState<Tab>(
    typeof location !== "undefined" && location.hash === "#profile" ? "profile" : "feed",
  );
  function setTab(t: Tab) {
    setTabState(t);
    if (typeof location !== "undefined") location.hash = t === "profile" ? "profile" : "";
  }
  return (
    <div className="app">
      <Header tab={tab} setTab={setTab} />
      {tab === "feed" ? <Feed /> : <Profile />}
    </div>
  );
}
