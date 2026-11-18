"use client";

import React, { useState } from "react";
import { FileText } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";

export default function DocsPage() {
  const { activeWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Docs"
          description={`Shared notes, specifications, and team documentation for ${activeWorkspace?.name || "your workspace"}.`}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search documents..."
        />

        <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8">
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No documents yet"
            description="Documents created in this workspace will appear here."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
