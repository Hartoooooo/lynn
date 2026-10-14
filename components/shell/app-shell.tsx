"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Sidebar, type NavTopic } from "@/components/sidebar/sidebar";
import { SearchBar } from "@/components/search/search-bar";
import { ToastProvider } from "@/components/toast";
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
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  // Handy: Menü nach Navigation schließen
  useEffect(() => setDrawer(false), [pathname]);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <ToastProvider>
      <div className="app-shell" data-collapsed={collapsed} data-drawer={drawer}>
        <Sidebar topics={topics} user={user} collapsed={drawer ? false : collapsed} onToggleCollapsed={toggle} />
        {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden />}
        <main className="app-main" id="main">
          <div className="mobile-topbar">
            <button
              onClick={() => setDrawer(true)}
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-2 hover:bg-surface-2"
              aria-label="Menü öffnen"
            >
              <Menu size={20} />
            </button>
            <Link href="/" className="flex items-center gap-2" aria-label="Lynn Startseite">
              <Logo size={24} />
              <span className="font-serif text-[18px] font-semibold tracking-tight">Lynn</span>
            </Link>
          </div>
          {children}
        </main>
        <Suspense>
          <SearchBar aiEnabled={aiEnabled} topics={topics} />
        </Suspense>
      </div>
    </ToastProvider>
  );
}
