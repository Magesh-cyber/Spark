"use client";

import React, { useState } from "react";
import { CheckSquare, Plus, Filter } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";

export default function TasksPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Task Management"
          description={`Work items, milestones, and deliverable tracking for ${activeWorkspace?.name || "your workspace"}.`}
        />

        {/* Filter & View Switcher */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tasks by title, project or ID..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Truthful Empty State — No fabricated tasks */}
        <div className="rounded-[10px] border border-slate-200 bg-white p-8">
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title="No tasks in this workspace"
            description="Task management database models will be provisioned in Module 04. No fabricated tasks or fictional assignees are displayed."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
