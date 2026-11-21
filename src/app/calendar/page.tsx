"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Video,
  CheckSquare,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  Folder,
  CalendarDays,
  Layers,
  Sparkles,
  User,
  Filter,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/workspace-context";
import { getWorkspaceMeetings, ScheduledMeetingItem } from "@/lib/actions/meetings";
import {
  getWorkspaceTasks,
  createWorkspaceTask,
  TaskRecordItem,
} from "@/lib/actions/tasks";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { getWorkspaceProjects, ProjectRecordItem } from "@/lib/actions/projects";
import { WorkspaceMemberItem } from "@/lib/types";
import { TaskDetailsDrawer } from "@/components/tasks/TaskDetailsDrawer";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_OPTIONS = [
  { key: "LOW", label: "Low", dotColor: "bg-zinc-400", textColor: "text-zinc-600 dark:text-zinc-400" },
  { key: "MEDIUM", label: "Medium", dotColor: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  { key: "HIGH", label: "High", dotColor: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
  { key: "URGENT", label: "Urgent", dotColor: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400" },
] as const;

export default function CalendarPage() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [tasks, setTasks] = useState<TaskRecordItem[]>([]);
  const [projects, setProjects] = useState<ProjectRecordItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calendar View: "month" (default) or "week"
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  // Selected anchor date for the calendar
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Task Details Drawer State
  const [selectedTask, setSelectedTask] = useState<TaskRecordItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Add Task on Specific Date Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetDateForTask, setTargetDateForTask] = useState<Date>(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newTaskStatus, setNewTaskStatus] = useState<"TODO" | "IN_PROGRESS" | "DONE">("TODO");
  const [newTaskDueTime, setNewTaskDueTime] = useState("18:00");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Day Overflow Modal State
  const [overflowModalDate, setOverflowModalDate] = useState<Date | null>(null);

  // Load Workspace Calendar Data
  const loadCalendarData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [mRes, tRes, pRes, memRes] = await Promise.all([
        getWorkspaceMeetings(activeWorkspace.id),
        getWorkspaceTasks(activeWorkspace.id),
        getWorkspaceProjects(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
      ]);
      if (mRes.success) setMeetings(mRes.meetings);
      if (tRes.success) setTasks(tRes.tasks);
      if (pRes.success) setProjects(pRes.projects);
      if (memRes.members) setMembers(memRes.members);
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Dismiss success toast automatically after 4 seconds
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Date utilities
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return isSameDay(d, today);
  };

  // Compute 7 days of the currently selected week (Monday-first)
  const getWeekDays = (anchorDate: Date) => {
    const dayOfWeek = anchorDate.getDay(); // 0 is Sun, 1 is Mon
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(anchorDate);
    monday.setDate(anchorDate.getDate() + mondayOffset);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: d, isCurrentMonth: d.getMonth() === anchorDate.getMonth() };
    });
  };

  // Compute 35 or 42 grid cells for the full month (Monday-first)
  const getMonthGridDays = (anchorDate: Date) => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startDate = new Date(year, month, 1 - startOffset);

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      cells.push({
        date: d,
        isCurrentMonth: d.getMonth() === month,
      });
    }

    // If the 6th row (days 35-41) consists entirely of next month, slice to 35 cells (5 rows)
    if (cells.slice(35).every((cell) => !cell.isCurrentMonth)) {
      return cells.slice(0, 35);
    }
    return cells;
  };

  const calendarGrid = useMemo(() => {
    if (viewMode === "week") {
      return getWeekDays(currentDate);
    }
    return getMonthGridDays(currentDate);
  }, [viewMode, currentDate]);

  // Calendar Header Navigation Handlers
  const handlePrev = () => {
    if (viewMode === "week") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open "Add Task for Date" Modal
  const handleOpenAddTaskForDate = (date: Date, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetDateForTask(date);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("MEDIUM");
    setNewTaskStatus("TODO");
    setNewTaskDueTime("18:00");
    setNewTaskProjectId("");
    setNewTaskAssigneeId(currentUser?.id || "");
    setCreateTaskError(null);
    setIsCreateModalOpen(true);
  };

  // Submit and save new task for that day
  const handleSaveTaskForDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;
    if (!newTaskTitle.trim()) {
      setCreateTaskError("Task title is required.");
      return;
    }

    setIsSavingTask(true);
    setCreateTaskError(null);

    try {
      // Calculate due date timestamp matching the target calendar day and time
      const [hours, minutes] = newTaskDueTime.split(":").map(Number);
      const computedDue = new Date(targetDateForTask);
      computedDue.setHours(isNaN(hours) ? 18 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

      const res = await createWorkspaceTask({
        workspaceId: activeWorkspace.id,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        status: newTaskStatus,
        dueDate: computedDue.toISOString(),
        projectId: newTaskProjectId || undefined,
        assigneeId: newTaskAssigneeId || undefined,
      });

      if (!res.success || !res.task) {
        setCreateTaskError(res.error || "Failed to create task.");
        return;
      }

      // Optimistically update calendar tasks state
      setTasks((prev) => [res.task!, ...prev]);
      setIsCreateModalOpen(false);
      setSuccessToast(`Task "${res.task.title}" saved for ${computedDue.toLocaleDateString(undefined, { month: "short", day: "numeric" })}!`);
    } catch (err: any) {
      setCreateTaskError(err.message || "Failed to save task.");
    } finally {
      setIsSavingTask(false);
    }
  };

  // Open Task Drawer for Inspection / Editing
  const handleOpenTask = (task: TaskRecordItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const handleTaskUpdatedInDrawer = (updated: TaskRecordItem) => {
    setSelectedTask(updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleTaskDeletedInDrawer = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setIsDrawerOpen(false);
    setSelectedTask(null);
  };

  // Format month and year label
  const monthYearLabel = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <ShellLayout>
      <div className="space-y-5">
        {/* Page Header with Calendar Navigation, View Switcher & Action Buttons */}
        <PageHeader
          title="Team Calendar"
          description={`Deadlines, deliverables, and scheduled meetings for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Month / Week View Toggle */}
              <div className="inline-flex items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={cn(
                    "px-3 py-1 rounded-[6px] font-medium transition-all duration-150",
                    viewMode === "month"
                      ? "bg-[var(--spark-accent)] text-white shadow-2xs font-semibold"
                      : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={cn(
                    "px-3 py-1 rounded-[6px] font-medium transition-all duration-150",
                    viewMode === "week"
                      ? "bg-[var(--spark-accent)] text-white shadow-2xs font-semibold"
                      : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                  )}
                >
                  Week
                </button>
              </div>

              {/* Month Navigator */}
              <div className="flex items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-l-[7px] transition-colors duration-150"
                  title="Previous"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-semibold text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] border-x border-[var(--spark-border)] transition-colors duration-150"
                  title="Jump to current date"
                >
                  {monthYearLabel}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1.5 text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] rounded-r-[7px] transition-colors duration-150"
                  title="Next"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="hidden sm:inline-flex text-xs"
              >
                Today
              </Button>

              {/* Primary Action: Add Task */}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => handleOpenAddTaskForDate(new Date())}
              >
                Add Task
              </Button>

              {/* Secondary Link: Schedule Meeting */}
              <Link href="/meet">
                <Button variant="outline" size="sm" leftIcon={<Video className="h-3.5 w-3.5" />}>
                  Meet
                </Button>
              </Link>
            </div>
          }
        />

        {/* Success Toast Banner */}
        {successToast && (
          <div className="flex items-center justify-between rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Complete Month / Week Calendar Viewport */}
        <div className="rounded-[16px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-sm overflow-hidden transition-colors duration-150">
          {/* Weekday Column Headers (Mon to Sun) */}
          <div className="grid grid-cols-7 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/70 text-center select-none">
            {WEEKDAYS.map((dayName, idx) => (
              <div
                key={dayName}
                className={cn(
                  "py-2.5 text-[11px] sm:text-xs font-semibold text-[var(--spark-text-secondary)]",
                  idx < 6 && "border-r border-[var(--spark-border)]/60"
                )}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 divide-y divide-[var(--spark-border)]/60 bg-[var(--spark-canvas)]/20">
            {calendarGrid.map((cell, idx) => {
              const day = cell.date;
              const dayIsToday = isToday(day);
              const isCurrMonth = cell.isCurrentMonth;

              // Filter tasks & meetings for this day
              const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.startTime), day));
              const dayTasks = tasks.filter((t) => {
                if (t.dueDate) return isSameDay(new Date(t.dueDate), day);
                if (t.startDate) return isSameDay(new Date(t.startDate), day);
                return false;
              });

              const totalItems = dayMeetings.length + dayTasks.length;
              const maxDisplay = viewMode === "week" ? 8 : 3;
              const visibleMeetings = dayMeetings.slice(0, maxDisplay);
              const remainingSlots = Math.max(0, maxDisplay - visibleMeetings.length);
              const visibleTasks = dayTasks.slice(0, remainingSlots);
              const overflowCount = totalItems - (visibleMeetings.length + visibleTasks.length);

              const colIndex = idx % 7;

              return (
                <div
                  key={day.toISOString() + idx}
                  onClick={() => handleOpenAddTaskForDate(day)}
                  className={cn(
                    "group relative flex flex-col justify-between p-2 sm:p-2.5 transition-all duration-150 cursor-pointer select-none",
                    colIndex < 6 && "border-r border-[var(--spark-border)]/60",
                    viewMode === "week" ? "min-h-[380px]" : "min-h-[125px] sm:min-h-[145px] lg:min-h-[155px]",
                    isCurrMonth
                      ? "bg-[var(--spark-surface)] hover:bg-[var(--spark-surface-subtle)]/50"
                      : "bg-[var(--spark-surface-subtle)]/30 hover:bg-[var(--spark-surface-subtle)]/60 opacity-60 hover:opacity-90",
                    dayIsToday && "ring-1 ring-inset ring-[var(--spark-accent)]/50 bg-[var(--spark-surface-selected)]/20"
                  )}
                >
                  {/* Day Header Row: Day number & Quick '+' Add Button */}
                  <div className="flex items-center justify-between mb-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center text-xs font-semibold transition-transform duration-150 group-hover:scale-105",
                          dayIsToday
                            ? "h-6 w-6 rounded-full bg-[var(--spark-accent)] text-white shadow-2xs font-bold"
                            : isCurrMonth
                            ? "text-[var(--spark-text-primary)]"
                            : "text-[var(--spark-text-muted)]"
                        )}
                      >
                        {day.getDate()}
                      </span>

                      {/* Today Pill in Week View */}
                      {dayIsToday && viewMode === "week" && (
                        <span className="rounded-full bg-[var(--spark-accent)]/15 px-1.5 py-0.2 text-[9px] font-bold text-[var(--spark-accent)]">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Quick '+' Add Task Button (reveals on hover/tap) */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenAddTaskForDate(day, e)}
                      title={`Add task for ${day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-[5px] p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-surface-subtle)] transition-all duration-150"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Events & Tasks List in Cell */}
                  <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    {/* Scheduled Meetings */}
                    {visibleMeetings.map((m) => (
                      <div
                        key={m.id}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-[5px] border border-[var(--spark-accent)]/25 bg-[var(--spark-surface-selected)]/80 px-1.5 py-0.8 text-[10px] text-[var(--spark-text-primary)] hover:border-[var(--spark-accent)] transition-colors duration-150 truncate"
                        title={`Meeting: ${m.title} (${new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`}
                      >
                        <Video className="h-2.5 w-2.5 shrink-0 text-[var(--spark-accent)]" />
                        <span className="font-semibold text-[9px] text-[var(--spark-accent)] shrink-0">
                          {new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}

                    {/* Scheduled Tasks */}
                    {visibleTasks.map((t) => {
                      const priority = PRIORITY_OPTIONS.find((p) => p.key === t.priority) || PRIORITY_OPTIONS[1];
                      const isDone = t.status === "DONE";

                      return (
                        <div
                          key={t.id}
                          onClick={(e) => handleOpenTask(t, e)}
                          className={cn(
                            "flex items-center justify-between gap-1 rounded-[5px] border px-1.5 py-0.8 text-[10px] transition-all duration-150 hover:shadow-2xs",
                            isDone
                              ? "border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/70 text-[var(--spark-text-muted)] line-through"
                              : "border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-primary)] hover:border-[var(--spark-border-strong)]"
                          )}
                          title={`${t.issueKey ? `[${t.issueKey}] ` : ""}${t.title} • Priority: ${t.priority} • Status: ${t.status}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priority.dotColor)} />
                            <span className="truncate font-medium">{t.title}</span>
                          </div>

                          {t.projectKey && (
                            <span className="hidden sm:inline-block text-[8px] font-mono text-[var(--spark-text-muted)] shrink-0 uppercase">
                              {t.projectKey}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Overflow Badge if > 3 items */}
                    {overflowCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverflowModalDate(day);
                        }}
                        className="mt-auto text-left text-[9px] font-bold text-[var(--spark-accent)] hover:underline px-1 py-0.5"
                      >
                        +{overflowCount} more
                      </button>
                    )}
                  </div>

                  {/* Empty state prompt on hover when empty */}
                  {totalItems === 0 && (
                    <div className="hidden group-hover:flex items-center justify-center text-[10px] text-[var(--spark-text-muted)]/70 py-1">
                      <span className="text-[9px] flex items-center gap-1">
                        <Plus className="h-2.5 w-2.5" /> Add task
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Task for Specific Date Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogHeader onClose={() => setIsCreateModalOpen(false)}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-surface-selected)] text-[var(--spark-accent)]">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Add Task for Date</DialogTitle>
              <p className="text-xs text-[var(--spark-accent)] font-semibold">
                {targetDateForTask.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSaveTaskForDate} className="space-y-4 py-2">
          {createTaskError && (
            <div className="flex items-center gap-2 rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createTaskError}</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="e.g. Complete quarterly security compliance audit..."
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
              Description (Optional)
            </label>
            <Textarea
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Add key deliverables, acceptance criteria, or links..."
              rows={3}
            />
          </div>

          {/* Priority & Status Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
                Priority
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/40 p-1">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setNewTaskPriority(p.key)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-[6px] py-1 text-[11px] font-medium transition-all duration-150",
                      newTaskPriority === p.key
                        ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] font-semibold shadow-2xs border border-[var(--spark-border)]"
                        : "text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.dotColor)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
                Status
              </label>
              <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/40 p-1">
                {[
                  { key: "TODO", label: "To Do" },
                  { key: "IN_PROGRESS", label: "In Prog" },
                  { key: "DONE", label: "Done" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setNewTaskStatus(s.key as any)}
                    className={cn(
                      "flex items-center justify-center rounded-[6px] py-1 text-[11px] font-medium transition-all duration-150",
                      newTaskStatus === s.key
                        ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] font-semibold shadow-2xs border border-[var(--spark-border)]"
                        : "text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Due Time, Project & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
                Target Time
              </label>
              <Input
                type="time"
                value={newTaskDueTime}
                onChange={(e) => setNewTaskDueTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
                Project
              </label>
              <select
                value={newTaskProjectId}
                onChange={(e) => setNewTaskProjectId(e.target.value)}
                className="w-full h-9 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-2.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
              >
                <option value="">(No Project / General)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--spark-text-secondary)] mb-1">
                Assignee
              </label>
              <select
                value={newTaskAssigneeId}
                onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                className="w-full h-9 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-2.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.fullName || m.user?.email || m.userId} {m.userId === currentUser?.id ? "(You)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSavingTask}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingTask}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Save Task
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL 2: Day Overflow Modal (shows all events & tasks when day has many items) */}
      {overflowModalDate && (
        <Dialog open={Boolean(overflowModalDate)} onOpenChange={() => setOverflowModalDate(null)}>
          <DialogHeader onClose={() => setOverflowModalDate(null)}>
            <div className="flex items-center justify-between w-full pr-6">
              <div>
                <DialogTitle>Day Schedule</DialogTitle>
                <p className="text-xs text-[var(--spark-accent)] font-semibold">
                  {overflowModalDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="h-3 w-3" />}
                onClick={() => {
                  const target = overflowModalDate;
                  setOverflowModalDate(null);
                  handleOpenAddTaskForDate(target);
                }}
              >
                Add Task
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3 max-h-[60vh] overflow-y-auto">
            {/* Meetings for this date */}
            {meetings
              .filter((m) => isSameDay(new Date(m.startTime), overflowModalDate))
              .map((m) => (
                <div
                  key={m.id}
                  className="rounded-[8px] border border-[var(--spark-accent)]/30 bg-[var(--spark-surface-selected)]/50 p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="h-4 w-4 text-[var(--spark-accent)] shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--spark-text-primary)]">{m.title}</p>
                      <p className="text-[10px] text-[var(--spark-text-secondary)]">
                        {new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Hosted by {m.creatorName}
                      </p>
                    </div>
                  </div>
                  <Link href={m.roomCode ? `/meet?room=${m.roomCode}` : "/meet"}>
                    <Button size="sm" className="h-7 px-2 text-[11px]" variant="primary">
                      Join
                    </Button>
                  </Link>
                </div>
              ))}

            {/* Tasks for this date */}
            {tasks
              .filter((t) => {
                if (t.dueDate) return isSameDay(new Date(t.dueDate), overflowModalDate);
                if (t.startDate) return isSameDay(new Date(t.startDate), overflowModalDate);
                return false;
              })
              .map((t) => {
                const priority = PRIORITY_OPTIONS.find((p) => p.key === t.priority) || PRIORITY_OPTIONS[1];
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setOverflowModalDate(null);
                      handleOpenTask(t);
                    }}
                    className="rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-2.5 hover:border-[var(--spark-border-strong)] cursor-pointer flex items-center justify-between transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", priority.dotColor)} />
                      <div>
                        <p className="text-xs font-semibold text-[var(--spark-text-primary)]">{t.title}</p>
                        <p className="text-[10px] text-[var(--spark-text-secondary)]">
                          {t.issueKey && <span className="font-mono text-[var(--spark-accent)] mr-1.5">{t.issueKey}</span>}
                          {t.projectName || "General"} • Assignee: {t.assigneeName || "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={t.status === "DONE" ? "success" : "default"} size="sm">
                      {t.status}
                    </Badge>
                  </div>
                );
              })}
          </div>
        </Dialog>
      )}

      {/* Task Details Drawer (when user clicks any task to view/edit/comment) */}
      <TaskDetailsDrawer
        task={selectedTask}
        workspaceId={activeWorkspace?.id || ""}
        members={members}
        projects={projects}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={handleTaskUpdatedInDrawer}
        onTaskDeleted={handleTaskDeletedInDrawer}
      />
    </ShellLayout>
  );
}