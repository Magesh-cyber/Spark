"use client";

import React, { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { TopProgressBar } from "./TopProgressBar";

export const ShellLayoutContext = createContext<boolean>(false);

interface ShellLayoutProps {
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {
  const alreadyInShell = useContext(ShellLayoutContext);
  const pathname = usePathname();

  // If already rendered inside the persistent ShellLayout, pass children through directly
  if (alreadyInShell) {
    return <>{children}</>;
  }

  // Auth pages and invitation acceptance pages do not render the workspace shell
  const isAuthPage =
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/invitations/accept");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <ShellLayoutContext.Provider value={true}>
      <TopProgressBar />
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
    </ShellLayoutContext.Provider>
  );
};
