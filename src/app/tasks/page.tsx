"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "@/lib/actions/tasks";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { WorkspaceMemberItem } from "@/lib/types";

const BOARD_COLUMNS = [
  { key: "TODO", label: "Backlog / To Do", icon: CircleDashed, badgeVariant: "default" as const },
  { key: "IN_PROGRESS", label: "In Progress", icon: Clock, badgeVariant: "violet" as const },
  { key: "IN_REVIEW", label: "In Review", icon: Eye, badgeVariant: "warning" as const },
  { key: "DONE", label: "Completed", icon: CheckCircle2, badgeVariant: "success" as const },
];

export default function TasksPage() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const [tasks, setTasks] = useState<TaskRecordItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");
  const [isLoading, setIsLoading] = useState(true);

  // New Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [status, setStatus] = useState<"BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE">("TODO");
  const [assigneeId, setAssigneeId] = useState("");
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
      const [tasksRes, membersRes] = await Promise.all([
        getWorkspaceTasks(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
      ]);
      if (tasksRes.success) setTasks(tasksRes.tasks);
      if (membersRes.members) setMembers(membersRes.members);
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
      setFormError("Task title is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await createWorkspaceTask({
        workspaceId: activeWorkspace.id,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to create task.");
      } else if (res.task) {
        setTasks((prev) => [res.task!, ...prev]);
        setIsModalOpen(false);
        setTitle("");
        setDescription("");
        setDueDate("");
        setAssigneeId("");
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    await updateTaskStatus(activeWorkspace.id, taskId, newStatus);
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await deleteTask(activeWorkspace.id, taskId);
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigneeName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description={`Track issues, deliverables, and team assignments for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setIsModalOpen(true)}
            >
              New Task
            </Button>
          }
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tasks by title, description, or assignee..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {viewMode === "board" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BOARD_COLUMNS.map((col) => {
              const Icon = col.icon;
              const columnTasks = filteredTasks.filter(
                (t) =>
                  t.status === col.key ||
                  (col.key === "TODO" && t.status === "BACKLOG")
              );

              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/55">
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

                  <div className="p-3 min-h-[300px] flex-1 flex flex-col gap-2.5 bg-[var(--spark-canvas)]/30">
                    {columnTasks.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[var(--spark-text-muted)]">
                        <p className="text-[11px]">No tasks</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-subtle hover:border-[var(--spark-border-strong)] transition-all space-y-2 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold text-[var(--spark-text-primary)] leading-snug">
                              {task.title}
                            </h4>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--spark-text-muted)] hover:text-red-500 rounded transition-opacity"
                              title="Delete task"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-[var(--spark-text-secondary)] line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px]">
                            {getPriorityBadge(task.priority)}

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
                          </div>

                          <div className="flex items-center justify-between border-t border-[var(--spark-border)] pt-2 mt-1">
                            {task.assigneeName ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Avatar
                                  name={task.assigneeName}
                                  size="sm"
                                  src={task.assigneeAvatar || undefined}
                                />
                                <span className="text-[10px] font-medium text-[var(--spark-text-secondary)] truncate">
                                  {task.assigneeName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--spark-text-muted)] italic">
                                Unassigned
                              </span>
                            )}

                            {/* Column Mover */}
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleStatusChange(task.id, e.target.value as any)
                              }
                              className="text-[10px] rounded border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] px-1.5 py-0.5 text-[var(--spark-text-secondary)] focus:outline-none"
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="IN_REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 overflow-x-auto">
            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-5 w-5" />}
                title="No tasks found"
                description="Create a task to track deliverables and notify assignees."
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--spark-border)] text-[var(--spark-text-muted)]">
                    <th className="pb-2.5 font-semibold">Title</th>
                    <th className="pb-2.5 font-semibold">Status</th>
                    <th className="pb-2.5 font-semibold">Priority</th>
                    <th className="pb-2.5 font-semibold">Assignee</th>
                    <th className="pb-2.5 font-semibold">Due Date</th>
                    <th className="pb-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--spark-border)] text-[var(--spark-text-primary)]">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-[var(--spark-surface-subtle)]/40">
                      <td className="py-2.5 font-medium">{t.title}</td>
                      <td className="py-2.5">
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value as any)}
                          className="text-[11px] rounded border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] px-2 py-0.5 text-[var(--spark-text-secondary)]"
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="DONE">Done</option>
                        </select>
                      </td>
                      <td className="py-2.5">{getPriorityBadge(t.priority)}</td>
                      <td className="py-2.5">
                        {t.assigneeName ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={t.assigneeName} size="sm" src={t.assigneeAvatar || undefined} />
                            <span>{t.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--spark-text-muted)]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-2.5 text-[var(--spark-text-secondary)]">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-[var(--spark-text-muted)] hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Create Task Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-[#0D0B14]/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md rounded-[12px] border spark-glass bg-[var(--spark-surface)] p-6 shadow-modal">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--spark-border)]">
                <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                  Create New Task
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

              <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Implement real-time notifications"
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Details, acceptance criteria..."
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Assignee
                    </label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user?.fullName} ({m.user?.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
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
                    Create Task
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
