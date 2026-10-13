"use client";

import { useEffect, useState } from "react";
import { Sidebar, type NavTopic } from "@/components/sidebar/sidebar";
import { SearchBar } from "@/components/search/search-bar";
import type { UserRole } from "@/lib/database.types";

const COLLAPSE_KEY = "lynn.sidebar.collapsed";

export function AppShell({
  topics,
  user,
  aiEnabled,
  children,
}: {
  topics: NavTopic[];
  user: { name: string; email: string; role: UserRole };
  aiEnabled: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <Sidebar topics={topics} user={user} collapsed={collapsed} onToggleCollapsed={toggle} />
      <main className="app-main" id="main">
        {children}
      </main>
      <SearchBar aiEnabled={aiEnabled} topics={topics} />
    </div>
  );
}
