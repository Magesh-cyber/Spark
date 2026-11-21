"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckSquare,
  CircleDashed,
  Clock,
  Eye,
  CheckCircle2,
  Trash2,
  Calendar,
  AlertCircle,
  User,
  X,
  Bug,
  BookOpen,
  Zap,
  Filter,
  Layers,
  MessageSquare,
  Check,
  ChevronDown,
  CornerDownRight,
  ArrowUpDown,
  Tag,
  Paperclip,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceTasks,
  updateTaskStatus,
  deleteTask,
  TaskRecordItem,
  WorkItemType,
} from "@/lib/actions/tasks";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { getWorkspaceProjects, ProjectRecordItem } from "@/lib/actions/projects";
import { WorkspaceMemberItem } from "@/lib/types";
import { TaskDetailsDrawer } from "@/components/tasks/TaskDetailsDrawer";

const BOARD_COLUMNS = [
  { key: "BACKLOG", label: "Backlog", icon: CircleDashed, badgeVariant: "default" as const },
  { key: "TODO", label: "To Do", icon: CircleDashed, badgeVariant: "default" as const },
  { key: "IN_PROGRESS", label: "In Progress", icon: Clock, badgeVariant: "violet" as const },
  { key: "IN_REVIEW", label: "In Review", icon: Eye, badgeVariant: "warning" as const },
  { key: "DONE", label: "Done", icon: CheckCircle2, badgeVariant: "success" as const },
];

const ISSUE_TYPE_CONFIG: Record<
  WorkItemType,
  { label: string; icon: any; color: string; badge: string }
> = {
  TASK: {
    label: "Task",
    icon: CheckSquare,
    color: "text-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  BUG: {
    label: "Bug",
    icon: Bug,
    color: "text-rose-500",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  STORY: {
    label: "Story",
    icon: BookOpen,
    color: "text-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  EPIC: {
    label: "Epic",
    icon: Zap,
    color: "text-[var(--spark-accent)]",
    badge: "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] border border-[var(--spark-accent)]/20",
  },
  SUBTASK: {
    label: "Subtask",
    icon: CornerDownRight,
    color: "text-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
};

type QuickFilterType =
  | "ALL"
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE"
  | "HIGH_PRIORITY"
  | "OVERDUE";

function TasksContent() {
  const searchParams = useSearchParams();
  const initialProjectFilter = searchParams.get("project") || "";

  const { activeWorkspace, currentUser } = useWorkspace();
  const [tasks, setTasks] = useState<TaskRecordItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [projects, setProjects] = useState<ProjectRecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectFilter);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "DUE_DATE" | "PRIORITY" | "KEY">("NEWEST");

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Drawer / Inspection
  const [selectedTask, setSelectedTask] = useState<TaskRecordItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [tasksRes, membersRes, projectsRes] = await Promise.all([
        getWorkspaceTasks(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
        getWorkspaceProjects(activeWorkspace.id),
      ]);
      if (tasksRes.success) setTasks(tasksRes.tasks);
      if (membersRes.members) setMembers(membersRes.members);
      if (projectsRes.projects) setProjects(projectsRes.projects);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (
    taskId: string,
    newStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE",
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    // Optimistic update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    const res = await updateTaskStatus(activeWorkspace.id, taskId, newStatus);
    if (!res.success) {
      // Rollback on failure
      setTasks(previousTasks);
      alert(res.error || "Failed to update status.");
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnKey: any) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);

    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== columnKey) {
        await handleStatusChange(taskId, columnKey);
      }
    }
  };

  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this issue?")) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setIsDrawerOpen(false);
      setSelectedTask(null);
    }
    await deleteTask(activeWorkspace.id, taskId);
  };

  const handleOpenTask = (task: TaskRecordItem) => {
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

  const accessibleProjectIds = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects]
  );

  // Strictly isolate tasks to those assigned to the current user for projects they reside in
  const myAssignedTasks = useMemo(() => {
    if (!currentUser?.id) return [];
    return tasks.filter((t) => {
      if (t.assigneeId !== currentUser.id) return false;
      if (t.projectId && !accessibleProjectIds.has(t.projectId)) return false;
      return true;
    });
  }, [tasks, currentUser?.id, accessibleProjectIds]);

  const todoCount = useMemo(
    () => myAssignedTasks.filter((t) => t.status === "TODO" || t.status === "BACKLOG").length,
    [myAssignedTasks]
  );
  const inProgressCount = useMemo(
    () => myAssignedTasks.filter((t) => t.status === "IN_PROGRESS").length,
    [myAssignedTasks]
  );
  const inReviewCount = useMemo(
    () => myAssignedTasks.filter((t) => t.status === "IN_REVIEW").length,
    [myAssignedTasks]
  );
  const doneCount = useMemo(
    () => myAssignedTasks.filter((t) => t.status === "DONE").length,
    [myAssignedTasks]
  );
  const overdueCount = useMemo(() => {
    const now = new Date();
    return myAssignedTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
    ).length;
  }, [myAssignedTasks]);

  // Filter tasks with Quick Filters, Search, Dropdowns, and Sorting
  const filteredTasks = useMemo(() => {
    const now = new Date();

    const filtered = myAssignedTasks.filter((t) => {
      // Search query (matches title, description, key, labels)
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.issueKey && t.issueKey.toLowerCase().includes(q)) ||
        t.labels?.some((l) => l.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Project filter
      if (selectedProjectId && t.projectId !== selectedProjectId) {
        return false;
      }

      // Type filter
      if (selectedType && t.type !== selectedType) {
        return false;
      }

      // Priority filter
      if (selectedPriority && t.priority !== selectedPriority) {
        return false;
      }

      // Quick filter tabs
      switch (quickFilter) {
        case "TODO":
          return t.status === "TODO" || t.status === "BACKLOG";
        case "IN_PROGRESS":
          return t.status === "IN_PROGRESS";
        case "IN_REVIEW":
          return t.status === "IN_REVIEW";
        case "DONE":
          return t.status === "DONE";
        case "HIGH_PRIORITY":
          return t.priority === "HIGH" || t.priority === "URGENT";
        case "OVERDUE":
          return t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE";
        case "ALL":
        default:
          return true;
      }
    });

    // Sorting
    return filtered.sort((a, b) => {
      if (sortBy === "DUE_DATE") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "PRIORITY") {
        const order: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[b.priority] || 0) - (order[a.priority] || 0);
      }
      if (sortBy === "KEY") {
        return (a.issueKey || "").localeCompare(b.issueKey || "");
      }
      // NEWEST default
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    myAssignedTasks,
    searchQuery,
    selectedProjectId,
    selectedType,
    selectedPriority,
    quickFilter,
    sortBy,
  ]);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENT":
        return <Badge variant="error" size="sm">Urgent</Badge>;
      case "HIGH":
        return <Badge variant="warning" size="sm">High</Badge>;
      case "MEDIUM":
        return <Badge variant="violet" size="sm">Medium</Badge>;
      case "LOW":
      default:
        return <Badge variant="default" size="sm">Low</Badge>;
    }
  };

  return (
    <ShellLayout>
      <div className="space-y-5">
        <PageHeader
          title="My Tasks"
          description={`Tasks assigned to you across projects you participate in within ${activeWorkspace?.name || "your workspace"}.`}
        />

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[var(--spark-border)]">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
            <button
              onClick={() => setQuickFilter("ALL")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "ALL"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              All Tasks ({myAssignedTasks.length})
            </button>

            <button
              onClick={() => setQuickFilter("TODO")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "TODO"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              To Do ({todoCount})
            </button>

            <button
              onClick={() => setQuickFilter("IN_PROGRESS")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "IN_PROGRESS"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              In Progress ({inProgressCount})
            </button>

            <button
              onClick={() => setQuickFilter("IN_REVIEW")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "IN_REVIEW"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              In Review ({inReviewCount})
            </button>

            <button
              onClick={() => setQuickFilter("DONE")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "DONE"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              Done ({doneCount})
            </button>

            <button
              onClick={() => setQuickFilter("HIGH_PRIORITY")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "HIGH_PRIORITY"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              High Priority
            </button>

            {overdueCount > 0 && (
              <button
                onClick={() => setQuickFilter("OVERDUE")}
                className={`px-3 py-1.5 rounded-[6px] font-semibold flex items-center gap-1.5 transition-colors ${
                  quickFilter === "OVERDUE"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Overdue ({overdueCount})</span>
              </button>
            )}
          </div>

          {/* Secondary Dropdown Selectors */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Project Dropdown */}
            {projects.length > 0 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Type Dropdown */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="TASK">Task</option>
              <option value="STORY">Story</option>
              <option value="BUG">Bug</option>
              <option value="EPIC">Epic</option>
              <option value="SUBTASK">Subtask</option>
            </select>

            {/* Priority Dropdown */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-secondary)] font-medium focus:outline-none"
            >
              <option value="NEWEST">Sort: Newest</option>
              <option value="DUE_DATE">Sort: Due Date</option>
              <option value="PRIORITY">Sort: Priority</option>
              <option value="KEY">Sort: Issue Key</option>
            </select>
          </div>
        </div>

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tasks by key, title, labels..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {!isLoading && myAssignedTasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-6 w-6" />}
            title="No tasks assigned to you"
            description="Tasks assigned to you across projects you belong to will appear here on your execution board. To create or assign tasks, visit Projects and select a project."
          />
        ) : viewMode === "board" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {BOARD_COLUMNS.map((col) => {
              const Icon = col.icon;
              const columnTasks = filteredTasks.filter((t) => t.status === col.key);
              const isOver = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.key)}
                  className={`flex flex-col rounded-[10px] border transition-colors ${
                    isOver
                      ? "border-[var(--spark-accent)] ring-2 ring-[var(--spark-accent)]/20 bg-[var(--spark-accent)]/5"
                      : "border-[var(--spark-border)] bg-[var(--spark-surface)]"
                  } overflow-hidden min-h-[520px]`}
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/65">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                        {col.label}
                      </span>
                    </div>
                    <Badge variant={col.badgeVariant} size="sm">
                      {columnTasks.length}
                    </Badge>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col gap-2.5 bg-[var(--spark-canvas)]/30">
                    {columnTasks.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[var(--spark-text-muted)] border-2 border-dashed border-[var(--spark-border)]/40 rounded-[8px] m-1">
                        <p className="text-[11px]">No tasks</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const typeConfig = ISSUE_TYPE_CONFIG[task.type] || ISSUE_TYPE_CONFIG.TASK;
                        const TypeIcon = typeConfig.icon;
                        const isDragging = draggedTaskId === task.id;
                        const isOverdue =
                          task.dueDate &&
                          new Date(task.dueDate) < new Date() &&
                          task.status !== "DONE";

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => handleOpenTask(task)}
                            className={`rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-subtle hover:border-[var(--spark-accent)] hover:shadow-md transition-all space-y-2 group cursor-grab active:cursor-grabbing select-none ${
                              isDragging ? "opacity-40 scale-95" : ""
                            }`}
                          >
                            {/* Top row: Type Icon + Issue Key + Project Badge */}
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={typeConfig.color} title={typeConfig.label}>
                                  <TypeIcon className="h-3.5 w-3.5" />
                                </span>
                                {task.issueKey && (
                                  <span className="font-mono font-bold text-[10px] text-[var(--spark-text-secondary)]">
                                    {task.issueKey}
                                  </span>
                                )}
                                {task.projectKey && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 truncate max-w-[90px]">
                                    {task.projectKey}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handleDeleteTask(task.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--spark-text-muted)] hover:text-rose-500 rounded transition-opacity"
                                title="Delete issue"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Title */}
                            <h4 className="text-xs font-semibold text-[var(--spark-text-primary)] leading-snug line-clamp-2">
                              {task.title}
                            </h4>

                            {/* Labels */}
                            {task.labels && task.labels.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {task.labels.slice(0, 3).map((l, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)]"
                                  >
                                    {l}
                                  </span>
                                ))}
                                {task.labels.length > 3 && (
                                  <span className="text-[9px] text-[var(--spark-text-muted)]">
                                    +{task.labels.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Indicators: Subtasks + Comments + Story Points */}
                            <div className="flex items-center gap-2 text-[10px] text-[var(--spark-text-muted)] pt-0.5">
                              {task.checklistTotal > 0 && (
                                <span className="flex items-center gap-1" title="Checklist Subtasks">
                                  <CheckSquare className="h-3 w-3" />
                                  <span>
                                    {task.checklistDone}/{task.checklistTotal}
                                  </span>
                                </span>
                              )}

                              {task.commentsCount > 0 && (
                                <span className="flex items-center gap-1" title="Comments">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{task.commentsCount}</span>
                                </span>
                              )}

                              {task.storyPoints != null && (
                                <span
                                  className="px-1.5 py-0.2 rounded font-mono font-bold bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)]"
                                  title="Story Points"
                                >
                                  {task.storyPoints} pts
                                </span>
                              )}
                            </div>

                            {/* Bottom row: Priority + Due Date + Assignee Avatar */}
                            <div className="flex items-center justify-between pt-1 border-t border-[var(--spark-border)]/50 text-[11px]">
                              {getPriorityBadge(task.priority)}

                              <div className="flex items-center gap-1.5">
                                {task.dueDate && (
                                  <div
                                    className={`flex items-center gap-1 text-[10px] ${
                                      isOverdue
                                        ? "text-rose-600 dark:text-rose-400 font-semibold"
                                        : "text-[var(--spark-text-muted)]"
                                    }`}
                                  >
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {new Date(task.dueDate).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                )}

                                {task.assigneeName ? (
                                  <Avatar
                                    name={task.assigneeName}
                                    size="sm"
                                    src={task.assigneeAvatar || undefined}
                                  />
                                ) : (
                                  <div
                                    className="h-5 w-5 rounded-full border border-dashed border-[var(--spark-border)] flex items-center justify-center text-[var(--spark-text-muted)]"
                                    title="Unassigned"
                                  >
                                    <User className="h-2.5 w-2.5" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List / Backlog View */
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--spark-surface-subtle)]/70 text-[10px] font-bold uppercase tracking-wider text-[var(--spark-text-muted)] border-b border-[var(--spark-border)]">
                  <tr>
                    <th className="py-2.5 px-3.5">Type & Key</th>
                    <th className="py-2.5 px-3">Title / Summary</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Labels</th>
                    <th className="py-2.5 px-3">Estimate</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--spark-border)]">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--spark-text-muted)]">
                        No issues matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const typeConfig = ISSUE_TYPE_CONFIG[task.type] || ISSUE_TYPE_CONFIG.TASK;
                      const TypeIcon = typeConfig.icon;
                      const isOverdue =
                        task.dueDate &&
                        new Date(task.dueDate) < new Date() &&
                        task.status !== "DONE";

                      return (
                        <tr
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          className="hover:bg-[var(--spark-surface-subtle)]/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono font-semibold">
                              <span className={typeConfig.color} title={typeConfig.label}>
                                <TypeIcon className="h-3.5 w-3.5" />
                              </span>
                              <span className="text-[var(--spark-text-primary)]">
                                {task.issueKey || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[var(--spark-text-primary)] max-w-xs truncate">
                            {task.title}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {task.projectKey ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                {task.projectKey}
                              </span>
                            ) : (
                              <span className="text-[var(--spark-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleStatusChange(
                                  task.id,
                                  e.target.value as TaskRecordItem["status"]
                                )
                              }
                              className="px-2 py-0.5 rounded text-[11px] font-semibold border border-[var(--spark-border)] bg-[var(--spark-canvas)] cursor-pointer"
                            >
                              <option value="BACKLOG">Backlog</option>
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="IN_REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getPriorityBadge(task.priority)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {task.assigneeName ? (
                                <>
                                  <Avatar
                                    name={task.assigneeName}
                                    size="sm"
                                    src={task.assigneeAvatar || undefined}
                                  />
                                  <span className="text-[var(--spark-text-secondary)] truncate max-w-[100px]">
                                    {task.assigneeName}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[var(--spark-text-muted)] italic">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {task.labels && task.labels.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {task.labels.slice(0, 2).map((l, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)]"
                                  >
                                    {l}
                                  </span>
                                ))}
                                {task.labels.length > 2 && (
                                  <span className="text-[9px] text-[var(--spark-text-muted)]">
                                    +{task.labels.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--spark-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[var(--spark-text-secondary)]">
                            {task.storyPoints != null ? `${task.storyPoints} pts` : "—"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {task.dueDate ? (
                              <span
                                className={
                                  isOverdue
                                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                                    : "text-[var(--spark-text-secondary)]"
                                }
                              >
                                {new Date(task.dueDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            ) : (
                              <span className="text-[var(--spark-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              className="p-1 text-[var(--spark-text-muted)] hover:text-rose-500 rounded transition-colors"
                              title="Delete issue"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Task Details Drawer */}
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

export default function TasksPage() {
  return (
    <React.Suspense
      fallback={
        <ShellLayout>
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--spark-accent)] border-t-transparent" />
          </div>
        </ShellLayout>
      }
    >
      <TasksContent />
    </React.Suspense>
  );
}
