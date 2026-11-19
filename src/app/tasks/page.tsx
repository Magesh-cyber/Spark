"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckSquare,
  CircleDashed,
  Clock,
  Eye,
  CheckCircle2,
  Plus,
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
  createWorkspaceTask,
  updateTaskStatus,
  deleteTask,
  TaskRecordItem,
  JiraIssueType,
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
  JiraIssueType,
  { label: string; icon: any; color: string; badge: string }
> = {
  TASK: { label: "Task", icon: CheckSquare, color: "text-blue-500", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  BUG: { label: "Bug", icon: Bug, color: "text-rose-500", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  STORY: { label: "Story", icon: BookOpen, color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  EPIC: { label: "Epic", icon: Zap, color: "text-purple-500", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
};

type QuickFilterType = "ALL" | "MY_TASKS" | "REPORTED" | "BUGS" | "HIGH_PRIORITY";

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

  // Jira Quick Filter Tab & Project Filter
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectFilter);

  // Drawer / Inspection
  const [selectedTask, setSelectedTask] = useState<TaskRecordItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // New Issue Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<JiraIssueType>("TASK");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [status, setStatus] = useState<"BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE">("TODO");
  const [assigneeId, setAssigneeId] = useState("");
  const [modalProjectId, setModalProjectId] = useState("");
  const [storyPoints, setStoryPoints] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Issue title is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await createWorkspaceTask({
        workspaceId: activeWorkspace.id,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        status,
        priority,
        projectId: modalProjectId || undefined,
        storyPoints: storyPoints === "" ? undefined : Number(storyPoints),
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to create issue.");
      } else if (res.task) {
        setTasks((prev) => [res.task!, ...prev]);
        setIsModalOpen(false);
        setTitle("");
        setDescription("");
        setType("TASK");
        setStoryPoints("");
        setDueDate("");
        setAssigneeId("");
        setModalProjectId("");
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE",
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    await updateTaskStatus(activeWorkspace.id, taskId, newStatus);
  };

  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  // Filter tasks with Jira Quick Filters & Project Filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search query
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.issueKey && t.issueKey.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Project filter
      if (selectedProjectId && t.projectId !== selectedProjectId) {
        return false;
      }

      // Quick filter tabs
      switch (quickFilter) {
        case "MY_TASKS":
          return t.assigneeId === currentUser?.id;
        case "REPORTED":
          return t.createdById === currentUser?.id;
        case "BUGS":
          return t.type === "BUG";
        case "HIGH_PRIORITY":
          return t.priority === "HIGH" || t.priority === "URGENT";
        case "ALL":
        default:
          return true;
      }
    });
  }, [tasks, searchQuery, selectedProjectId, quickFilter, currentUser?.id]);

  const myTasksCount = useMemo(
    () => tasks.filter((t) => t.assigneeId === currentUser?.id).length,
    [tasks, currentUser?.id]
  );
  const bugsCount = useMemo(() => tasks.filter((t) => t.type === "BUG").length, [tasks]);

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
          title="Issues & Tasks"
          description={`Jira-style work management, sprints, and deliverable tracking for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setIsModalOpen(true)}
            >
              Create Issue
            </Button>
          }
        />

        {/* Jira Quick Filter Tabs & Project Selector */}
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
              All Issues ({tasks.length})
            </button>

            <button
              onClick={() => setQuickFilter("MY_TASKS")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold flex items-center gap-1.5 transition-colors ${
                quickFilter === "MY_TASKS"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>My Tasks ({myTasksCount})</span>
            </button>

            <button
              onClick={() => setQuickFilter("REPORTED")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "REPORTED"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              Reported by Me
            </button>

            <button
              onClick={() => setQuickFilter("BUGS")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold flex items-center gap-1.5 transition-colors ${
                quickFilter === "BUGS"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              <Bug className="h-3.5 w-3.5" />
              <span>Bugs Only ({bugsCount})</span>
            </button>

            <button
              onClick={() => setQuickFilter("HIGH_PRIORITY")}
              className={`px-3 py-1.5 rounded-[6px] font-semibold transition-colors ${
                quickFilter === "HIGH_PRIORITY"
                  ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                  : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
              }`}
            >
              High & Urgent
            </button>
          </div>

          {/* Project Filter Dropdown */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] font-medium text-[var(--spark-text-muted)] flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Project:
              </span>
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
            </div>
          )}
        </div>

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search issues by key, title, assignee..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Board (Kanban) View */}
        {viewMode === "board" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {BOARD_COLUMNS.map((col) => {
              const Icon = col.icon;
              const columnTasks = filteredTasks.filter((t) => t.status === col.key);

              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden min-h-[480px]"
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
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[var(--spark-text-muted)]">
                        <p className="text-[11px]">No issues</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const typeConfig = ISSUE_TYPE_CONFIG[task.type] || ISSUE_TYPE_CONFIG.TASK;
                        const TypeIcon = typeConfig.icon;

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenTask(task)}
                            className="rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-subtle hover:border-[var(--spark-accent)] hover:shadow-md transition-all space-y-2 group cursor-pointer select-none"
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

                            {/* Indicators: Subtasks + Comments + Story Points */}
                            <div className="flex items-center gap-2 text-[10px] text-[var(--spark-text-muted)] pt-0.5">
                              {task.checklistTotal > 0 && (
                                <span className="flex items-center gap-1" title="Subtasks">
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
                                  <div className="flex items-center gap-1 text-[10px] text-[var(--spark-text-muted)]">
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
                                  <div className="h-5 w-5 rounded-full border border-dashed border-[var(--spark-border)] flex items-center justify-center text-[var(--spark-text-muted)]">
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
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Estimate</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--spark-border)]">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[var(--spark-text-muted)]">
                        No issues matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const typeConfig = ISSUE_TYPE_CONFIG[task.type] || ISSUE_TYPE_CONFIG.TASK;
                      const TypeIcon = typeConfig.icon;

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
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[var(--spark-text-secondary)]">
                            {task.storyPoints != null ? `${task.storyPoints} pts` : "—"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[var(--spark-text-secondary)]">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
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

      {/* Task Details Jira Drawer */}
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

      {/* Create Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 shadow-xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--spark-border)] pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-[var(--spark-accent)]" />
                <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">
                  Create Jira Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-[8px] bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              {/* Type and Project Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Issue Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as JiraIssueType)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="TASK">Task (Standard)</option>
                    <option value="BUG">Bug (Defect)</option>
                    <option value="STORY">Story (Feature)</option>
                    <option value="EPIC">Epic (Milestone)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Project
                  </label>
                  <select
                    value={modalProjectId}
                    onChange={(e) => setModalProjectId(e.target.value)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="">General (No project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.key}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                  Issue Summary <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Implement OAuth2 Refresh Token Rotation"
                  className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                  Description / Acceptance Criteria
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Steps to reproduce, user story narrative, or requirements..."
                  rows={3}
                  className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)] resize-y"
                />
              </div>

              {/* Priority, Story Points, Due Date */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Story Points
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={storyPoints}
                    onChange={(e) =>
                      setStoryPoints(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="e.g. 3"
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Assignee & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  >
                    <option value="BACKLOG">Backlog</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
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
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? "Creating..." : "Create Issue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
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
