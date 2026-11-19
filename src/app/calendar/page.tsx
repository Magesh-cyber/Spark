"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Video,
  CheckSquare,
  Clock,
  Plus,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";
import { getWorkspaceMeetings, ScheduledMeetingItem } from "@/lib/actions/meetings";
import { getWorkspaceTasks, TaskRecordItem } from "@/lib/actions/tasks";
import Link from "next/link";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [tasks, setTasks] = useState<TaskRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Week offset state (0 = current week, -1 = last week, +1 = next week)
  const [weekOffset, setWeekOffset] = useState(0);

  const loadCalendarData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        getWorkspaceMeetings(activeWorkspace.id),
        getWorkspaceTasks(activeWorkspace.id),
      ]);
      if (mRes.success) setMeetings(mRes.meetings);
      if (tRes.success) setTasks(tRes.tasks);
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Compute 5 weekdays (Mon - Fri) based on weekOffset
  const getWeekDays = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);

    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays();

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const monthYearLabel = weekDays[0].toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Team Calendar"
          description={`Deadlines, milestones, and scheduled meetings for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)]">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-l-[7px] transition-colors duration-150"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2.5 text-xs font-semibold text-[var(--spark-text-primary)] whitespace-nowrap">
                  {monthYearLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-r-[7px] transition-colors duration-150"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <Link href="/meet">
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  Schedule
                </Button>
              </Link>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {weekDays.map((day) => {
            const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.startTime), day));
            const dayTasks = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
            const dayIsToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] min-h-[380px] flex flex-col overflow-hidden transition-colors duration-150"
              >
                <div
                  className={
                    dayIsToday
                      ? "p-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-highlight)] text-xs font-semibold text-[var(--spark-highlight-text)] text-center flex items-center justify-center gap-1.5"
                      : "p-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/60 text-xs font-semibold text-[var(--spark-text-primary)] text-center"
                  }
                >
                  <span>
                    {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {dayIsToday && (
                    <span className="rounded-full bg-[var(--spark-accent)] px-1.5 py-0.2 text-[9px] font-bold text-white">
                      Today
                    </span>
                  )}
                </div>

                <div className="p-2.5 flex-1 flex flex-col gap-2 overflow-y-auto bg-[var(--spark-canvas)]/30">
                  {dayMeetings.length === 0 && dayTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--spark-text-muted)] p-4">
                      <CalendarIcon className="h-4 w-4 mb-1 opacity-40" />
                      <span className="text-[10px]">No events</span>
                    </div>
                  ) : (
                    <>
                      {/* Scheduled Meetings */}
                      {dayMeetings.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-[6px] border border-[var(--spark-accent)]/30 bg-[var(--spark-highlight)]/40 p-2 space-y-1 text-left shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 text-[var(--spark-accent)]">
                            <Video className="h-3 w-3 shrink-0" />
                            <span className="text-[11px] font-semibold truncate text-[var(--spark-text-primary)]">
                              {m.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--spark-text-secondary)]">
                            <span>
                              {new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-[9px] text-[var(--spark-text-muted)] truncate max-w-[80px]">
                              {m.creatorName}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Task Deadlines */}
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-2 space-y-1 text-left shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="text-[11px] font-semibold truncate text-[var(--spark-text-primary)]">
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--spark-text-secondary)]">
                            <Badge variant="warning" size="sm">
                              {t.priority}
                            </Badge>
                            <span className="text-[9px] text-[var(--spark-text-muted)] truncate max-w-[80px]">
                              {t.assigneeName || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ShellLayout>
  );
}
