"use client";

import React from "react";
import { WorkspaceProvider } from "@/lib/workspace-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

