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
          title="Docs & Knowledge Base"
          description={`Central repository for product specifications, architectural notes, and team knowledge for ${activeWorkspace?.name || "your workspace"}.`}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search documents by title or category..."
        />

        {/* Truthful Empty State — No fabricated documents or fictional authors */}
        <div className="rounded-[10px] border border-slate-200 bg-white p-8">
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No workspace documents yet"
            description="Documentation storage, versioning, and shared product specifications will populate here once documents are initialized in this workspace."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
