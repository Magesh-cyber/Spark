"use client";

import React from "react";
import { ThemeProvider } from "@/lib/theme-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { NexconnChatProvider } from "@/components/chat/NexconnChatProvider";
import { ShellLayout } from "@/components/layout/ShellLayout";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <NexconnChatProvider>
          <ShellLayout>{children}</ShellLayout>
        </NexconnChatProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
