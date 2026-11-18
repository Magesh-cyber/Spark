"use client";

import React from "react";
import { Video } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";

export default function MeetPage() {
  const { activeWorkspace } = useWorkspace();

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Meetings"
          description={`Audio and video meeting rooms for ${activeWorkspace?.name || "your workspace"}.`}
        />

        <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8">
          <EmptyState
            icon={<Video className="h-5 w-5" />}
            title="No scheduled meetings"
            description="Upcoming team calls and instant meeting rooms for this workspace will appear here."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
