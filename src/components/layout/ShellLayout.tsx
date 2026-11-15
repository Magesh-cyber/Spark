"use client";

import React from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { GlobalSearchModal } from "./GlobalSearchModal";

interface ShellLayoutProps {
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 antialiased">
      {/* App Sidebar: Desktop persistent + Mobile drawer */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Quick Search Modal (Cmd+K / Ctrl+K) */}
      <GlobalSearchModal />
    </div>
  );
};
