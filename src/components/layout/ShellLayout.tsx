"use client";

import React, { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { TopProgressBar } from "./TopProgressBar";
import { IncomingCallDialog } from "@/components/chat/IncomingCallDialog";
import { cn } from "@/lib/utils";

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

  // Full-bleed three-pane canvas on messaging view for maximum horizontal ergonomics
  const isFullBleedWorkspace = pathname?.startsWith("/chat");

  return (
    <ShellLayoutContext.Provider value={true}>
      <TopProgressBar />
      <div className="flex min-h-screen bg-[var(--spark-canvas)] text-[var(--spark-text-primary)] antialiased transition-colors duration-150">
        {/* Far-Left Collapsible Navigation Rail (Desktop persistent + Mobile drawer) */}
        <AppSidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />
          <main
            className={cn(
              "flex-1 w-full mx-auto",
              isFullBleedWorkspace
                ? "p-2 sm:p-4 max-w-none"
                : "p-4 sm:p-6 md:p-8 max-w-7xl"
            )}
          >
            {children}
          </main>
        </div>

        {/* Global Quick Search Modal (Cmd+K / Ctrl+K) */}
        <GlobalSearchModal />

        {/* Global 1-on-1 Incoming Call Dialog */}
        <IncomingCallDialog />
      </div>
    </ShellLayoutContext.Provider>
  );
};
