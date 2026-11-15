"use client";

import React from "react";
import { Menu, Search, Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { NotificationMenu } from "./NotificationMenu";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const AppHeader: React.FC = () => {
  const { setSidebarOpen, setSearchModalOpen, currentUser, activeWorkspace } = useWorkspace();

  return (
    <header className="sticky top-0 z-20 flex h-[60px] w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      {/* Left Area: Mobile hamburger toggle & Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar Trigger (Linear/Raycast style) */}
        <button
          type="button"
          onClick={() => setSearchModalOpen(true)}
          className="flex h-9 w-44 sm:w-64 md:w-80 items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-100/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">Search or type a command...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Area: Actions, Notifications, User */}
      <div className="flex items-center gap-2.5">
        <NotificationMenu />

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User preview */}
        <div className="flex items-center gap-2">
          <Avatar name={currentUser.name} size="sm" />
          <span className="hidden sm:inline-block text-xs font-medium text-slate-700 max-w-[100px] truncate">
            {currentUser.name}
          </span>
        </div>
      </div>
    </header>
  );
};

