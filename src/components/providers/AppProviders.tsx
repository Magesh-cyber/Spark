"use client";

import React from "react";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { NexconnChatProvider } from "@/components/chat/NexconnChatProvider";
import { ShellLayout } from "@/components/layout/ShellLayout";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <NexconnChatProvider>
        <ShellLayout>{children}</ShellLayout>
      </NexconnChatProvider>
    </WorkspaceProvider>
  );
}
