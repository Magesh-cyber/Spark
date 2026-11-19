"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckSquare,
  Bug,
  BookOpen,
  Zap,
  Calendar,
  User,
  Clock,
  MessageSquare,
  Check,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  AlertCircle,
  Hash,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { enhanceTaskDescription, generateTaskSubtasks } from "@/lib/ai/service";
import {
  TaskRecordItem,
  WorkItemType,
  TaskChecklistItemData,
  TaskCommentData,
  updateTaskDetails,
  getTaskChecklist,
  addTaskChecklistItem,
  toggleTaskChecklistItem,
  deleteTaskChecklistItem,
  getTaskComments,
  addTaskComment,
  deleteTask,
} from "@/lib/actions/tasks";
import { ProjectRecordItem } from "@/lib/actions/projects";
import { WorkspaceMemberItem } from "@/lib/types";

interface TaskDetailsDrawerProps {
  task: TaskRecordItem | null;
  workspaceId: string;
  members: WorkspaceMemberItem[];
  projects: ProjectRecordItem[];
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updated: TaskRecordItem) => void;
  onTaskDeleted: (taskId: string) => void;
}

const ISSUE_TYPE_CONFIG: Record<
  WorkItemType,
  { label: string; icon: any; color: string; bg: string }
> = {
  TASK: { label: "Task", icon: CheckSquare, color: "text-blue-500", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  BUG: { label: "Bug", icon: Bug, color: "text-rose-500", bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  STORY: { label: "Story", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  EPIC: { label: "Epic", icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
};

const STATUS_OPTIONS: { key: TaskRecordItem["status"]; label: string; color: string }[] = [
  { key: "BACKLOG", label: "Backlog", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
  { key: "TODO", label: "To Do", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  { key: "IN_REVIEW", label: "In Review", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { key: "DONE", label: "Done", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
];

const PRIORITY_OPTIONS = [
  { key: "LOW", label: "Low", color: "text-zinc-500" },
  { key: "MEDIUM", label: "Medium", color: "text-blue-500" },
  { key: "HIGH", label: "High", color: "text-amber-500" },
  { key: "URGENT", label: "Urgent", color: "text-rose-500" },
] as const;

export function TaskDetailsDrawer({
  task,
  workspaceId,
  members,
  projects,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailsDrawerProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<TaskRecordItem["status"]>(task?.status || "TODO");
  const [priority, setPriority] = useState<TaskRecordItem["priority"]>(task?.priority || "MEDIUM");
  const [type, setType] = useState<WorkItemType>(task?.type || "TASK");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "");
  const [projectId, setProjectId] = useState(task?.projectId || "");
  const [storyPoints, setStoryPoints] = useState<number | "">(task?.storyPoints || "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");

  // Subtasks / Checklist
  const [checklist, setChecklist] = useState<TaskChecklistItemData[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);

  // Comments
  const [comments, setComments] = useState<TaskCommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);

  const [copiedKey, setCopiedKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setType(task.type || "TASK");
      setAssigneeId(task.assigneeId || "");
      setProjectId(task.projectId || "");
      setStoryPoints(task.storyPoints ?? "");
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");

      // Load checklist & comments
      setIsLoadingChecklist(true);
      getTaskChecklist(workspaceId, task.id)
        .then((res) => {
          if (res.items) setChecklist(res.items);
        })
        .finally(() => setIsLoadingChecklist(false));

      setIsLoadingComments(true);
      getTaskComments(workspaceId, task.id)
        .then((res) => {
          if (res.comments) setComments(res.comments);
        })
        .finally(() => setIsLoadingComments(false));
    }
  }, [task, workspaceId]);

  const handleSaveField = useCallback(
    async (fieldUpdates: Partial<TaskRecordItem>) => {
      if (!task) return;
      setIsSaving(true);
      try {
        const payload: any = { ...fieldUpdates };
        await updateTaskDetails(workspaceId, task.id, payload);
        onTaskUpdated({
          ...task,
          ...fieldUpdates,
          assigneeName:
            fieldUpdates.assigneeId !== undefined
              ? members.find((m) => m.userId === fieldUpdates.assigneeId)?.user.fullName || null
              : task.assigneeName,
          projectName:
            fieldUpdates.projectId !== undefined
              ? projects.find((p) => p.id === fieldUpdates.projectId)?.name || null
              : task.projectName,
          projectKey:
            fieldUpdates.projectId !== undefined
              ? projects.find((p) => p.id === fieldUpdates.projectId)?.key || null
              : task.projectKey,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [task, workspaceId, members, projects, onTaskUpdated]
  );

  const handleCopyKey = () => {
    if (!task?.issueKey) return;
    navigator.clipboard.writeText(task.issueKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistTitle.trim()) return;
    const res = await addTaskChecklistItem(workspaceId, task.id, newChecklistTitle.trim());
    if (res.item) {
      setChecklist((prev) => [...prev, res.item!]);
      setNewChecklistTitle("");
      onTaskUpdated({
        ...task,
        checklistTotal: task.checklistTotal + 1,
      });
    }
  };

  const handleToggleChecklistItem = async (itemId: string, current: boolean) => {
    if (!task) return;
    const next = !current;
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isCompleted: next } : i))
    );
    await toggleTaskChecklistItem(workspaceId, itemId, next);
    onTaskUpdated({
      ...task,
      checklistDone: task.checklistDone + (next ? 1 : -1),
    });
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!task) return;
    const item = checklist.find((i) => i.id === itemId);
    setChecklist((prev) => prev.filter((i) => i.id !== itemId));
    await deleteTaskChecklistItem(workspaceId, itemId);
    onTaskUpdated({
      ...task,
      checklistTotal: Math.max(0, task.checklistTotal - 1),
      checklistDone: item?.isCompleted ? Math.max(0, task.checklistDone - 1) : task.checklistDone,
    });
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newComment.trim()) return;
    setIsPostingComment(true);
    try {
      const res = await addTaskComment(workspaceId, task.id, newComment.trim());
      if (res.comment) {
        setComments((prev) => [...prev, res.comment!]);
        setNewComment("");
        onTaskUpdated({
          ...task,
          commentsCount: task.commentsCount + 1,
        });
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (confirm(`Delete issue ${task.issueKey || task.title}? This cannot be undone.`)) {
      await deleteTask(workspaceId, task.id);
      onTaskDeleted(task.id);
      onClose();
    }
  };

  const handleAIEnhanceDescription = async () => {
    if (!task) return;
    setIsEnhancingDescription(true);
    try {
      const res = await enhanceTaskDescription(title || task.title, description || task.description);
      if (res?.enhanced) {
        setDescription(res.enhanced);
        await handleSaveField({ description: res.enhanced });
      }
    } catch (err) {
      console.error("AI description enhancement failed:", err);
    } finally {
      setIsEnhancingDescription(false);
    }
  };

  const handleAIGenerateSubtasks = async () => {
    if (!task) return;
    setIsGeneratingSubtasks(true);
    try {
      const res = await generateTaskSubtasks(title || task.title, description || task.description);
      if (res?.subtasks && res.subtasks.length > 0) {
        for (const item of res.subtasks) {
          await addTaskChecklistItem(workspaceId, task.id, item);
        }
        const updated = await getTaskChecklist(workspaceId, task.id);
        if (updated.items) {
          setChecklist(updated.items);
          onTaskUpdated({
            ...task,
            checklistTotal: updated.items.length,
            checklistDone: updated.items.filter((c) => c.isCompleted).length,
          });
        }
      }
    } catch (err) {
      console.error("AI subtasks generation failed:", err);
    } finally {
      setIsGeneratingSubtasks(false);
    }
  };

  if (!isOpen || !task) return null;

  const currentTypeConfig = ISSUE_TYPE_CONFIG[type] || ISSUE_TYPE_CONFIG.TASK;
  const TypeIcon = currentTypeConfig.icon;
  const currentStatusConfig = STATUS_OPTIONS.find((s) => s.key === status) || STATUS_OPTIONS[1];

  const completedChecklistCount = checklist.filter((c) => c.isCompleted).length;
  const checklistPercent =
    checklist.length > 0 ? Math.round((completedChecklistCount / checklist.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[var(--spark-surface)] h-full shadow-2xl flex flex-col border-l border-[var(--spark-border)] animate-in slide-in-from-right duration-200">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[var(--spark-border)] flex items-center justify-between bg-[var(--spark-surface-subtle)]/50">
          <div className="flex items-center gap-2.5">
            {/* Issue Type Selector */}
            <div className="relative group">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold border ${currentTypeConfig.bg}`}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                <span>{currentTypeConfig.label}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as WorkItemType;
                  setType(newType);
                  handleSaveField({ type: newType });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="EPIC">Epic</option>
              </select>
            </div>

            {/* Issue Key */}
            {task.issueKey && (
              <button
                type="button"
                onClick={handleCopyKey}
                className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-mono font-semibold text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] transition-colors"
                title="Click to copy issue key"
              >
                <span>{task.issueKey}</span>
                {copiedKey ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 opacity-60" />
                )}
              </button>
            )}

            {isSaving && (
              <span className="text-[10px] text-[var(--spark-text-muted)] flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Saving...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDeleteTask}
              className="p-1.5 rounded-[6px] text-[var(--spark-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Delete issue"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface)] transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== task.title) {
                  handleSaveField({ title: title.trim() });
                }
              }}
              className="w-full text-lg font-bold text-[var(--spark-text-primary)] bg-transparent border-b border-transparent hover:border-[var(--spark-border)] focus:border-[var(--spark-accent)] focus:outline-none transition-colors py-1"
              placeholder="Issue title"
            />
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-[10px] bg-[var(--spark-surface-subtle)]/70 border border-[var(--spark-border)] text-xs">
            {/* Status */}
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--spark-text-muted)] block mb-1">
                Status
              </span>
              <div className="relative">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-2.5 py-1 rounded-[6px] font-semibold border ${currentStatusConfig.color}`}
                >
                  <span>{currentStatusConfig.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                <select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as TaskRecordItem["status"];
                    setStatus(next);
                    handleSaveField({ status: next });
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--spark-text-muted)] block mb-1">
                Priority
              </span>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] font-medium text-[var(--spark-text-primary)]"
                >
                  <span className={PRIORITY_OPTIONS.find((p) => p.key === priority)?.color}>
                    {PRIORITY_OPTIONS.find((p) => p.key === priority)?.label || "Medium"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                <select
                  value={priority}
                  onChange={(e) => {
                    const next = e.target.value as TaskRecordItem["priority"];
                    setPriority(next);
                    handleSaveField({ priority: next });
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--spark-text-muted)] block mb-1">
                Assignee
              </span>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-2 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] font-medium text-[var(--spark-text-primary)] truncate"
                >
                  <span className="truncate">
                    {members.find((m) => m.userId === assigneeId)?.user.fullName || "Unassigned"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                </button>
                <select
                  value={assigneeId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAssigneeId(next);
                    handleSaveField({ assigneeId: next || null });
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Story Points */}
            <div>
              <span className="text-[10px] uppercase font-semibold text-[var(--spark-text-muted)] block mb-1">
                Story Points
              </span>
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : Number(e.target.value);
                  setStoryPoints(val);
                }}
                onBlur={() => {
                  handleSaveField({ storyPoints: storyPoints === "" ? null : Number(storyPoints) });
                }}
                placeholder="Pts (e.g. 3)"
                className="w-full px-2 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
              />
            </div>
          </div>

          {/* Secondary Properties Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Project Association */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--spark-text-muted)] w-20 shrink-0">
                Project:
              </span>
              <select
                value={projectId}
                onChange={(e) => {
                  const next = e.target.value;
                  setProjectId(next);
                  handleSaveField({ projectId: next || null });
                }}
                className="flex-1 px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
              >
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--spark-text-muted)] w-20 shrink-0">
                Due Date:
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDueDate(val);
                  handleSaveField({ dueDate: val || null });
                }}
                className="flex-1 px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                Description
              </span>
              <button
                type="button"
                onClick={handleAIEnhanceDescription}
                disabled={isEnhancingDescription}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 transition-all disabled:opacity-50"
                title="Structure acceptance criteria & definition of done with AI"
              >
                {isEnhancingDescription ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-amber-500" />
                )}
                <span>{isEnhancingDescription ? "Enhancing..." : "✨ AI Enhance"}</span>
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (task.description || "")) {
                  handleSaveField({ description: description.trim() || null });
                }
              }}
              rows={4}
              placeholder="Add issue description or acceptance criteria..."
              className="w-full p-3 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] leading-relaxed resize-y font-sans"
            />
          </div>

          {/* Subtasks / Checklist Section */}
          <div className="space-y-2.5 border-t border-[var(--spark-border)] pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[var(--spark-accent)]" />
                <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                  Subtasks & Checklist
                </span>
                <span className="text-[10px] text-[var(--spark-text-muted)] font-mono">
                  ({completedChecklistCount}/{checklist.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAIGenerateSubtasks}
                  disabled={isGeneratingSubtasks}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 transition-all disabled:opacity-50"
                  title="Generate action checklist items with AI"
                >
                  {isGeneratingSubtasks ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  )}
                  <span>{isGeneratingSubtasks ? "Generating..." : "✨ AI Subtasks"}</span>
                </button>
                {checklist.length > 0 && (
                  <span className="text-[10px] font-semibold text-[var(--spark-text-secondary)]">
                    {checklistPercent}% done
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {checklist.length > 0 && (
              <div className="h-1.5 w-full bg-[var(--spark-surface-subtle)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
            )}

            {/* Checklist items list */}
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[6px] hover:bg-[var(--spark-surface-subtle)]/70 group text-xs transition-colors"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => handleToggleChecklistItem(item.id, item.isCompleted)}
                      className="rounded border-[var(--spark-border)] text-[var(--spark-accent)] focus:ring-0 cursor-pointer"
                    />
                    <span
                      className={`truncate ${
                        item.isCompleted
                          ? "line-through text-[var(--spark-text-muted)]"
                          : "text-[var(--spark-text-primary)]"
                      }`}
                    >
                      {item.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--spark-text-muted)] hover:text-rose-500 rounded transition-opacity"
                    title="Remove item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add checklist item input */}
              <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder="Add a subtask or acceptance check..."
                  className="flex-1 px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)]"
                />
                <button
                  type="submit"
                  disabled={!newChecklistTitle.trim()}
                  className="px-2.5 py-1.5 rounded-[6px] bg-[var(--spark-accent)] text-white text-xs font-semibold hover:bg-[var(--spark-accent-hover)] disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </form>
            </div>
          </div>

          {/* Activity & Comments Section */}
          <div className="space-y-3 border-t border-[var(--spark-border)] pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--spark-accent)]" />
              <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                Activity & Discussion ({comments.length})
              </span>
            </div>

            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Leave an update, blocker note, or feedback..."
                rows={2}
                className="w-full p-2.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPostingComment || !newComment.trim()}
                  className="px-3 py-1.5 rounded-[6px] bg-[var(--spark-accent)] text-white text-xs font-semibold hover:bg-[var(--spark-accent-hover)] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {isPostingComment ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  <span>Comment</span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 pt-2">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 text-xs">
                  <Avatar name={comment.userName} size="sm" src={comment.userAvatar || undefined} />
                  <div className="flex-1 bg-[var(--spark-surface-subtle)]/70 border border-[var(--spark-border)] rounded-[8px] p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--spark-text-primary)]">
                        {comment.userName}
                      </span>
                      <span className="text-[10px] text-[var(--spark-text-muted)]">
                        {new Date(comment.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[var(--spark-text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
