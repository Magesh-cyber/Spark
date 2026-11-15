"use client";

import React from "react";
import { Video, Calendar } from "lucide-react";
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
          title="Video Meetings"
          description={`High-definition workplace audio and video meeting rooms for ${activeWorkspace?.name || "your workspace"}.`}
        />

        {/* Truthful Empty State — No fabricated participants or mock calls */}
        <div className="rounded-[10px] border border-slate-200 bg-white p-12">
          <EmptyState
            icon={<Video className="h-5 w-5" />}
            title="No scheduled meetings"
            description="Workplace video conferencing and scheduled meeting rooms will be enabled for your workspace in an upcoming release. Fictional video streams and mock attendees have been eliminated."
          />
        </div>
      </div>
    </ShellLayout>
  );
}
