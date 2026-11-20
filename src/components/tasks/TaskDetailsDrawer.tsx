"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckSquare,
  Bug,
  BookOpen,
  Zap,
  CornerDownRight,
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
  Paperclip,
  Download,
  Link as LinkIcon,
  Activity,
  Tag,
  Layers,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TaskRecordItem,
  WorkItemType,
  TaskChecklistItemData,
  TaskCommentData,
  TaskActivityItem,
  TaskAttachmentItem,
  TaskDependencyItem,
  updateTaskDetails,
  getTaskDetails,
  getTaskChecklist,
  addTaskChecklistItem,
  toggleTaskChecklistItem,
  deleteTaskChecklistItem,
  addTaskComment,
  deleteTaskComment,
  deleteTask,
  addTaskAttachment,
  deleteTaskAttachment,
  addTaskDependency,
  removeTaskDependency,
} from "@/lib/actions/tasks";
import { ProjectRecordItem } from "@/lib/actions/projects";
import { WorkspaceMemberItem } from "@/lib/types";
import { enhanceTaskDescription, generateTaskSubtasks } from "@/lib/ai/service";
import { cn } from "@/lib/utils";

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
  SUBTASK: { label: "Subtask", icon: CornerDownRight, color: "text-cyan-500", bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
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
  const [activeTab, setActiveTab] = useState<"details" | "dependencies" | "attachments" | "activity">("details");

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<TaskRecordItem["status"]>(task?.status || "TODO");
  const [priority, setPriority] = useState<TaskRecordItem["priority"]>(task?.priority || "MEDIUM");
  const [type, setType] = useState<WorkItemType>(task?.type || "TASK");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "");
  const [projectId, setProjectId] = useState(task?.projectId || "");
  const [storyPoints, setStoryPoints] = useState<number | "">(task?.storyPoints || "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [labels, setLabels] = useState<string[]>(task?.labels || []);
  const [newTagInput, setNewTagInput] = useState("");

  // Subtasks / Checklist
  const [checklist, setChecklist] = useState<TaskChecklistItemData[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");

  // Comments
  const [comments, setComments] = useState<TaskCommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Dependencies
  const [dependencies, setDependencies] = useState<TaskDependencyItem[]>([]);
  const [newDependsOnId, setNewDependsOnId] = useState("");
  const [newDependsType, setNewDependsType] = useState<"BLOCKS" | "BLOCKED_BY">("BLOCKS");
  const [isAddingDep, setIsAddingDep] = useState(false);

  // Activities
  const [activities, setActivities] = useState<TaskActivityItem[]>([]);

  // Subtasks
  const [subtasks, setSubtasks] = useState<any[]>([]);

  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load enriched task details whenever drawer opens
  const loadFullTask = useCallback(async () => {
    if (!task || !workspaceId) return;
    try {
      const res = await getTaskDetails(workspaceId, task.id);
      if (res.success && res.task) {
        setChecklist(res.task.checklists);
        setComments(res.task.comments);
        setActivities(res.task.activities);
        setAttachments(res.task.attachments);
        setDependencies(res.task.dependencies);
        setSubtasks(res.task.subtasks);
        setLabels(res.task.labels);
      }
    } catch (err) {
      console.error("Failed to load task details:", err);
    }
  }, [task, workspaceId]);

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
      setLabels(task.labels || []);
      loadFullTask();
    }
  }, [task, loadFullTask]);

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

  const handleAddTag = () => {
    const t = newTagInput.trim();
    if (!t || labels.includes(t)) return;
    const updated = [...labels, t];
    setLabels(updated);
    setNewTagInput("");
    handleSaveField({ labels: updated });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = labels.filter((l) => l !== tagToRemove);
    setLabels(updated);
    handleSaveField({ labels: updated });
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

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await deleteTaskComment(workspaceId, commentId);
    onTaskUpdated({
      ...task,
      commentsCount: Math.max(0, task.commentsCount - 1),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setIsUploadingAttachment(true);

    try {
      // Create local URL for immediate persistent display
      const fakeUrl = URL.createObjectURL(file);
      const res = await addTaskAttachment({
        workspaceId,
        taskId: task.id,
        fileName: file.name,
        fileUrl: fakeUrl,
        fileSize: file.size,
        fileType: file.type,
      });

      if (res.success && res.attachment) {
        setAttachments((prev) => [res.attachment!, ...prev]);
        onTaskUpdated({
          ...task,
          attachmentCount: task.attachmentCount + 1,
        });
      }
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (atId: string) => {
    if (!task) return;
    setAttachments((prev) => prev.filter((a) => a.id !== atId));
    await deleteTaskAttachment(workspaceId, atId);
    onTaskUpdated({
      ...task,
      attachmentCount: Math.max(0, task.attachmentCount - 1),
    });
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newDependsOnId) return;
    setIsAddingDep(true);

    try {
      const res = await addTaskDependency(workspaceId, task.id, newDependsOnId, newDependsType);
      if (res.success) {
        setNewDependsOnId("");
        loadFullTask();
      } else {
        alert(res.error || "Failed to add dependency.");
      }
    } finally {
      setIsAddingDep(false);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    if (!task) return;
    setDependencies((prev) => prev.filter((d) => d.id !== depId));
    await removeTaskDependency(workspaceId, depId);
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
        <div className="px-6 py-3.5 border-b border-[var(--spark-border)] flex items-center justify-between bg-[var(--spark-surface-subtle)]/50">
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
                <option value="SUBTASK">Subtask</option>
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/25 text-xs font-semibold">
          {[
            { id: "details", label: "Details & Subtasks", icon: FileText },
            { id: "dependencies", label: `Dependencies (${dependencies.length})`, icon: LinkIcon },
            { id: "attachments", label: `Attachments (${attachments.length})`, icon: Paperclip },
            { id: "activity", label: `Audit Log (${activities.length})`, icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "flex items-center gap-1.5 py-2.5 px-3 border-b-2 transition-all",
                  isActive
                    ? "border-[var(--spark-accent)] text-[var(--spark-accent)]"
                    : "border-transparent text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "details" && (
            <>
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
                    Points
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={storyPoints}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setStoryPoints(val);
                    }}
                    onBlur={() => {
                      const num = storyPoints === "" ? null : Number(storyPoints);
                      if (num !== task.storyPoints) {
                        handleSaveField({ storyPoints: num });
                      }
                    }}
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

              {/* Labels / Tags Section */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--spark-text-primary)] block">
                  Labels &amp; Tags
                </span>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]">
                  {labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-text-primary)]"
                    >
                      <Tag className="h-2.5 w-2.5 text-[var(--spark-accent)]" />
                      <span>{lbl}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(lbl)}
                        className="hover:text-rose-500 ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ Add tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="text-xs bg-transparent focus:outline-none min-w-[80px]"
                  />
                </div>
              </div>

              {/* Description Section with AI Enhance */}
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

              {/* Subtasks / Checklist Section with AI Subtasks */}
              <div className="space-y-2.5 border-t border-[var(--spark-border)] pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[var(--spark-accent)]" />
                    <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                      Subtasks &amp; Checklist
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

                {checklist.length > 0 && (
                  <div className="h-1.5 w-full bg-[var(--spark-surface-subtle)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${checklistPercent}%` }}
                    />
                  </div>
                )}

                <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Add a concrete subtask item..."
                    className="flex-1 px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={!newChecklistTitle.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </form>

                <div className="space-y-1.5">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-[6px] bg-[var(--spark-surface-subtle)]/40 hover:bg-[var(--spark-surface-subtle)] transition-colors text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => handleToggleChecklistItem(item.id, item.isCompleted)}
                          className="h-4 w-4 rounded border-[var(--spark-border)] accent-[var(--spark-accent)]"
                        />
                        <span className={cn("truncate", item.isCompleted && "line-through opacity-60")}>
                          {item.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="text-[var(--spark-text-muted)] hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discussion & Comments */}
              <div className="space-y-3 border-t border-[var(--spark-border)] pt-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--spark-accent)]" />
                  <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                    Activity &amp; Discussion ({comments.length})
                  </span>
                </div>

                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Leave a comment or update for the team..."
                    className="flex-1 px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                  />
                  <Button type="submit" size="sm" variant="primary" disabled={isPostingComment || !newComment.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>

                <div className="space-y-2.5 pt-2">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-[8px] bg-[var(--spark-canvas)]/60 border border-[var(--spark-border)] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name={c.userName} size="sm" src={c.userAvatar || undefined} />
                          <span className="font-semibold text-[var(--spark-text-primary)]">{c.userName}</span>
                          <span className="text-[10px] text-[var(--spark-text-muted)]">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-[var(--spark-text-muted)] hover:text-rose-500 p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-[var(--spark-text-secondary)] pl-6">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ================= TAB 2: DEPENDENCIES ================= */}
          {activeTab === "dependencies" && (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[var(--spark-text-primary)] mb-1">Issue Dependencies</h4>
                <p className="text-[var(--spark-text-secondary)]">
                  Link related issues that block or are blocked by this task. Circular relationships are automatically prevented.
                </p>
              </div>

              <form onSubmit={handleAddDependency} className="p-3.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--spark-text-muted)] mb-1">Relationship</label>
                    <select
                      value={newDependsType}
                      onChange={(e) => setNewDependsType(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs"
                    >
                      <option value="BLOCKS">Blocks</option>
                      <option value="BLOCKED_BY">Is Blocked By</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-[var(--spark-text-muted)] mb-1">Target Issue ID / Key</label>
                    <input
                      type="text"
                      placeholder="Paste task ID or issue key (e.g. CLA-2)..."
                      value={newDependsOnId}
                      onChange={(e) => setNewDependsOnId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="primary" disabled={isAddingDep || !newDependsOnId.trim()}>
                    Add Dependency
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                {dependencies.length === 0 ? (
                  <p className="text-[var(--spark-text-muted)] py-4 text-center">No dependencies configured for this issue.</p>
                ) : (
                  dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-2.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-500/10 text-violet-600">
                          {dep.type === "BLOCKS" ? "Blocks" : "Blocked By"}
                        </span>
                        <span className="font-mono font-bold text-[var(--spark-accent)]">{dep.dependsOnTaskKey}</span>
                        <span className="truncate max-w-xs">{dep.dependsOnTaskTitle}</span>
                        <Badge variant="default" size="sm">{dep.dependsOnTaskStatus}</Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDependency(dep.id)}
                        className="p-1 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 3: ATTACHMENTS ================= */}
          {activeTab === "attachments" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[var(--spark-text-primary)]">Files &amp; Deliverables</h4>
                  <p className="text-[var(--spark-text-secondary)]">
                    Upload specifications, screenshots, and logs securely.
                  </p>
                </div>
                <label className="cursor-pointer">
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--spark-accent)] text-white text-xs font-semibold hover:opacity-90">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Upload File</span>
                  </span>
                </label>
              </div>

              <div className="space-y-2 pt-2">
                {attachments.length === 0 ? (
                  <p className="text-[var(--spark-text-muted)] py-4 text-center">No attachments added to this issue.</p>
                ) : (
                  attachments.map((at) => (
                    <div
                      key={at.id}
                      className="flex items-center justify-between p-3 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Paperclip className="h-4 w-4 text-[var(--spark-accent)] shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold text-[var(--spark-text-primary)] truncate">{at.fileName}</div>
                          <div className="text-[10px] text-[var(--spark-text-muted)]">
                            Uploaded by {at.userName} on {new Date(at.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={at.fileUrl}
                          download={at.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)]"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(at.id)}
                          className="p-1 text-[var(--spark-text-muted)] hover:text-rose-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: AUDIT LOG ================= */}
          {activeTab === "activity" && (
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-[var(--spark-text-primary)]">Audit Trail</h4>
              <p className="text-[var(--spark-text-secondary)]">
                Server-generated changelog of all property updates, status shifts, and collaborator actions.
              </p>

              <div className="space-y-2.5 pt-2">
                {activities.length === 0 ? (
                  <p className="text-[var(--spark-text-muted)] py-4 text-center">No activity history recorded.</p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]/50"
                    >
                      <Avatar name={act.userName} size="sm" src={act.userAvatar || undefined} />
                      <div className="flex-1 space-y-0.5">
                        <div className="text-[var(--spark-text-primary)]">
                          <strong>{act.userName}</strong>{" "}
                          <span className="text-[var(--spark-text-secondary)]">
                            {act.action === "STATUS_CHANGED" && `changed status from ${act.oldValue} to ${act.newValue}`}
                            {act.action === "ASSIGNED" && `assigned to ${act.newValue}`}
                            {act.action === "PRIORITY_CHANGED" && `set priority to ${act.newValue}`}
                            {act.action === "CREATED" && act.newValue}
                            {act.action === "COMMENT_ADDED" && `commented: "${act.newValue}"`}
                            {act.action === "TITLE_CHANGED" && `renamed issue`}
                            {act.action === "DESCRIPTION_CHANGED" && `updated issue description`}
                            {act.action === "ATTACHMENT_ADDED" && `uploaded file: ${act.newValue}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--spark-text-muted)]">
                          {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
