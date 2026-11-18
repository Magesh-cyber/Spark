"use client";

import React, { useState } from "react";
import { CheckSquare, CircleDashed, Clock, Eye, CheckCircle2 } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";

const BOARD_COLUMNS = [
  { key: "todo", label: "Backlog", icon: CircleDashed, badgeVariant: "default" as const },
  { key: "in_progress", label: "In Progress", icon: Clock, badgeVariant: "violet" as const },
  { key: "in_review", label: "In Review", icon: Eye, badgeVariant: "warning" as const },
  { key: "done", label: "Completed", icon: CheckCircle2, badgeVariant: "success" as const },
];

export default function TasksPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description={`Track issues, milestones, and deliverables for ${activeWorkspace?.name || "your workspace"}.`}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tasks..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {viewMode === "board" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BOARD_COLUMNS.map((col) => {
              const Icon = col.icon;
              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/55">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                        {col.label}
                      </span>
                    </div>
                    <Badge variant={col.badgeVariant} size="sm">
                      0
                    </Badge>
                  </div>
                  <div className="p-4 min-h-[280px] flex flex-col items-center justify-center text-center">
                    <p className="text-[11px] text-[var(--spark-text-muted)]">
                      No tasks
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8">
            <EmptyState
              icon={<CheckSquare className="h-5 w-5" />}
              title="No tasks yet"
              description="Tasks created in this workspace will appear here."
            />
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
