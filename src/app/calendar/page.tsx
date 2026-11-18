"use client";

import React from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const days = ["Mon, Nov 16", "Tue, Nov 17", "Wed, Nov 18", "Thu, Nov 19", "Fri, Nov 20"];

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Team Calendar"
          description={`Upcoming milestones, deadlines, and scheduled events across ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)]">
                <button
                  type="button"
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-l-[7px] transition-colors duration-150"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2.5 text-xs font-semibold text-[var(--spark-text-primary)]">
                  November 2026
                </span>
                <button
                  type="button"
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-r-[7px] transition-colors duration-150"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {days.map((day, idx) => (
            <div
              key={day}
              className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] min-h-[360px] flex flex-col overflow-hidden transition-colors duration-150"
            >
              <div
                className={
                  idx === 2
                    ? "p-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-highlight)] text-xs font-semibold text-[var(--spark-highlight-text)] text-center"
                    : "p-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/60 text-xs font-semibold text-[var(--spark-text-primary)] text-center"
                }
              >
                {day}
              </div>
              <div className="p-4 flex-1 flex flex-col items-center justify-center text-center text-[var(--spark-text-muted)]">
                <CalendarIcon className="h-5 w-5 mb-1.5 opacity-50" />
                <span className="text-[11px]">No scheduled events</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShellLayout>
  );
}
