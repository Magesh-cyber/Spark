"use client";

import React from "react";
import { Menu, Search } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { NotificationMenu } from "./NotificationMenu";
import { ThemeToggle } from "./ThemeToggle";

export const AppHeader: React.FC = () => {
  const { setSidebarOpen, setSearchModalOpen } = useWorkspace();

  return (
    <header className="sticky top-0 z-20 flex h-[58px] w-full items-center justify-between border-b spark-glass px-4 sm:px-6 transition-colors duration-150">
      {/* Left Area: Mobile hamburger toggle & Global Search */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-[6px] p-1.5 text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] lg:hidden transition-colors duration-150"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar Trigger (Linear / Raycast style) */}
        <button
          type="button"
          onClick={() => setSearchModalOpen(true)}
          className="flex h-8 w-44 sm:w-64 md:w-80 items-center justify-between rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 text-xs text-[var(--spark-text-muted)] hover:border-[var(--spark-border-strong)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-3.5 w-3.5 text-[var(--spark-text-muted)] shrink-0" />
            <span className="truncate">Search or type a command...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center rounded-[4px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--spark-text-secondary)]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Area: Theme Toggle & Notifications */}
      <div className="flex items-center gap-2">
        <ThemeToggle variant="icon" />
        <NotificationMenu />
      </div>
    </header>
  );
};
