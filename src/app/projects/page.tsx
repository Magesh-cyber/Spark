"use client";

import React, { useState } from "react";
import { FolderKanban } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";

export default function ProjectsPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description={`High-level initiative tracking and roadmap milestones for ${activeWorkspace?.name || "your workspace"}.`}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search projects by name..."
        />

        {/* Truthful Empty State — No fabricated projects */}
        <div className="rounded-[10px] border border-slate-200 bg-white p-8">
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="No active projects"
            description="Project tracking and milestone deliverables will appear here once initiatives are initialized in this workspace."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
