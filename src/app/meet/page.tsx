"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Video,
  Plus,
  Calendar,
  Clock,
  User,
  ExternalLink,
  X,
  AlertCircle,
  VideoOff,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceMeetings,
  scheduleWorkspaceMeeting,
  ScheduledMeetingItem,
} from "@/lib/actions/meetings";

export default function MeetPage() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Schedule modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadMeetings = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await getWorkspaceMeetings(activeWorkspace.id);
      if (res.success) setMeetings(res.meetings);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !startTime) {
      setFormError("Title, date, and time are required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const fullIsoString = new Date(`${startDate}T${startTime}`).toISOString();
      const res = await scheduleWorkspaceMeeting({
        workspaceId: activeWorkspace.id,
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: fullIsoString,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to schedule meeting.");
      } else if (res.meeting) {
        setMeetings((prev) => [...prev, res.meeting!]);
        setIsModalOpen(false);
        setTitle("");
        setDescription("");
        setStartDate("");
        setStartTime("");
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Meetings"
          description={`Team syncs, scheduled calls, and video collaboration for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setIsModalOpen(true)}
            >
              Schedule Meeting
            </Button>
          }
        />

        {meetings.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8">
            <EmptyState
              icon={<Video className="h-5 w-5" />}
              title="No scheduled meetings"
              description="Upcoming team calls scheduled in this workspace will appear here."
              actionLabel="Schedule First Call"
              onAction={() => setIsModalOpen(true)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((m) => {
              const dateObj = new Date(m.startTime);
              const isPast = dateObj.getTime() < Date.now();

              return (
                <div
                  key={m.id}
                  className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-subtle hover:border-[var(--spark-border-strong)] transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                          <Video className="h-4 w-4" />
                        </div>
                        <h4 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                          {m.title}
                        </h4>
                      </div>
                      <Badge variant={isPast ? "default" : "violet"} size="sm">
                        {isPast ? "Concluded" : "Upcoming"}
                      </Badge>
                    </div>

                    {m.description && (
                      <p className="text-xs text-[var(--spark-text-secondary)] line-clamp-2">
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-[var(--spark-border)] pt-3 space-y-1.5 text-xs text-[var(--spark-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span>{dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span>{dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--spark-text-muted)]">
                      <User className="h-3 w-3" />
                      <span>Organized by {m.creatorName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Schedule Meeting Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-[#0D0B14]/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md rounded-[12px] border spark-glass bg-[var(--spark-surface)] p-6 shadow-modal">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--spark-border)]">
                <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                  Schedule Workspace Meeting
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSchedule} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Meeting Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Weekly Engineering Sync"
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Agenda / Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Meeting goals, topics to cover..."
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmitting}
                  >
                    Schedule & Notify Members
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
