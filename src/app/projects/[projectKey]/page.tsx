"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FolderKanban,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  User,
  Settings,
  Layers,
  ListTodo,
  Kanban,
  Activity,
  Milestone,
  Zap,
  Globe,
  Lock,
  Archive,
  RotateCcw,
  Trash2,
  Search,
  CheckSquare,
  Bug,
  BookOpen,
  CornerDownRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  Edit,
  Tag,
  Share2,
  X,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getProjectByKey,
  updateWorkspaceProject,
  archiveWorkspaceProject,
  restoreWorkspaceProject,
  deleteWorkspaceProject,
  addProjectMember,
  removeProjectMember,
  createProjectMilestone,
  toggleProjectMilestone,
  deleteProjectMilestone,
  DetailedProjectView,
} from "@/lib/actions/projects";
import {
  getWorkspaceTasks,
  createWorkspaceTask,
  updateTaskStatus,
  createSprint,
  updateSprintStatus,
  TaskRecordItem,
  WorkItemType,
  SprintItem,
} from "@/lib/actions/tasks";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { WorkspaceMemberItem } from "@/lib/types";
import { TaskDetailsDrawer } from "@/components/tasks/TaskDetailsDrawer";
import { cn } from "@/lib/utils";

const ISSUE_TYPE_CONFIG: Record<
  WorkItemType,
  { label: string; icon: any; color: string; bg: string }
> = {
  EPIC: { label: "Epic", icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  STORY: { label: "Story", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  TASK: { label: "Task", icon: CheckSquare, color: "text-blue-500", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  BUG: { label: "Bug", icon: Bug, color: "text-rose-500", bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  SUBTASK: { label: "Subtask", icon: CornerDownRight, color: "text-cyan-500", bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
};

const KANBAN_COLUMNS: { key: TaskRecordItem["status"]; label: string; dotColor: string }[] = [
  { key: "BACKLOG", label: "Backlog", dotColor: "bg-zinc-400" },
  { key: "TODO", label: "To Do", dotColor: "bg-slate-400" },
  { key: "IN_PROGRESS", label: "In Progress", dotColor: "bg-violet-500" },
  { key: "IN_REVIEW", label: "In Review", dotColor: "bg-amber-500" },
  { key: "DONE", label: "Done", dotColor: "bg-emerald-500" },
];

function ProjectDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectKey = (params?.projectKey as string) || "";
  const { activeWorkspace, currentUser } = useWorkspace();

  const tabParam = searchParams.get("tab");
  const [project, setProject] = useState<DetailedProjectView | null>(null);
  const [tasks, setTasks] = useState<TaskRecordItem[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "work-items" | "sprints" | "timeline" | "activity" | "settings"
  >(
    tabParam && ["overview", "work-items", "sprints", "timeline", "activity", "settings"].includes(tabParam)
      ? (tabParam as any)
      : "overview"
  );

  // Work items view toggle
  const [workItemsView, setWorkItemsView] = useState<"board" | "list">("board");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<TaskRecordItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [newIssueType, setNewIssueType] = useState<WorkItemType>("TASK");
  const [newIssuePriority, setNewIssuePriority] = useState<TaskRecordItem["priority"]>("MEDIUM");
  const [newIssueStatus, setNewIssueStatus] = useState<TaskRecordItem["status"]>("TODO");
  const [newIssueStoryPoints, setNewIssueStoryPoints] = useState<number | "">("");
  const [newIssueAssigneeId, setNewIssueAssigneeId] = useState("");
  const [newIssueStartDate, setNewIssueStartDate] = useState("");
  const [newIssueDueDate, setNewIssueDueDate] = useState("");
  const [newIssueSprintId, setNewIssueSprintId] = useState("");
  const [newIssueLabels, setNewIssueLabels] = useState("");
  const [issueFormError, setIssueFormError] = useState("");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Milestone creation
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // Sprint creation
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newSprintStart, setNewSprintStart] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");
  const [isSubmittingSprint, setIsSubmittingSprint] = useState(false);

  // Add member modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");

  // Settings form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editType, setEditType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load project details & workspace tasks
  const loadProject = useCallback(async () => {
    if (!activeWorkspace?.id || !projectKey) return;
    setIsLoading(true);

    try {
      const [projRes, tasksRes, memRes] = await Promise.all([
        getProjectByKey(activeWorkspace.id, projectKey),
        getWorkspaceTasks(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
      ]);

      if (projRes.success && projRes.project) {
        setProject(projRes.project);
        setEditName(projRes.project.name);
        setEditDescription(projRes.project.description || "");
        setEditCategory(projRes.project.category || "");
        setEditTargetDate(projRes.project.targetDate ? projRes.project.targetDate.slice(0, 10) : "");
        setEditType(projRes.project.type);
      }

      if (tasksRes.success) {
        // Filter tasks to this project
        setTasks(tasksRes.tasks.filter((t) => t.projectKey === projectKey.toUpperCase()));
      }

      if (memRes.members) {
        setWorkspaceMembers(memRes.members);
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id, projectKey]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Handle Drag & Drop status transition
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskRecordItem["status"]) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId || !project) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await updateTaskStatus(project.workspaceId, taskId, targetStatus);
      // Reload project to refresh stats
      const refreshed = await getProjectByKey(project.workspaceId, project.key);
      if (refreshed.project) setProject(refreshed.project);
    } catch (err) {
      console.error("Drag drop failed:", err);
      loadProject();
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueTitle.trim() || !project) {
      setIssueFormError("Issue summary is required.");
      return;
    }
    setIsSubmittingIssue(true);
    setIssueFormError("");

    const labels = newIssueLabels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await createWorkspaceTask({
        workspaceId: project.workspaceId,
        projectId: project.id,
        title: newIssueTitle.trim(),
        description: newIssueDescription.trim() || undefined,
        type: newIssueType,
        status: newIssueStatus,
        priority: newIssuePriority,
        storyPoints: newIssueStoryPoints === "" ? undefined : Number(newIssueStoryPoints),
        startDate: newIssueStartDate || undefined,
        dueDate: newIssueDueDate || undefined,
        assigneeId: newIssueAssigneeId || undefined,
        sprintId: newIssueSprintId || undefined,
        labels: labels.length > 0 ? labels : undefined,
      });

      if (!res.success) {
        setIssueFormError(res.error || "Failed to create issue.");
      } else if (res.task) {
        setTasks((prev) => [res.task!, ...prev]);
        setIsCreateIssueOpen(false);
        setNewIssueTitle("");
        setNewIssueDescription("");
        setNewIssueType("TASK");
        setNewIssueStatus("TODO");
        setNewIssuePriority("MEDIUM");
        setNewIssueStoryPoints("");
        setNewIssueStartDate("");
        setNewIssueDueDate("");
        setNewIssueAssigneeId("");
        setNewIssueSprintId("");
        setNewIssueLabels("");
        setIssueFormError("");

        const refreshed = await getProjectByKey(project.workspaceId, project.key);
        if (refreshed.project) setProject(refreshed.project);
      }
    } catch {
      setIssueFormError("An unexpected error occurred while creating issue.");
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !project) return;
    setIsAddingMilestone(true);

    try {
      const res = await createProjectMilestone({
        workspaceId: project.workspaceId,
        projectId: project.id,
        title: newMilestoneTitle.trim(),
        dueDate: newMilestoneDate || undefined,
      });

      if (res.success && res.milestone) {
        setProject((prev) =>
          prev ? { ...prev, milestones: [...prev.milestones, res.milestone!] } : prev
        );
        setNewMilestoneTitle("");
        setNewMilestoneDate("");
      }
    } finally {
      setIsAddingMilestone(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, isCompleted: boolean) => {
    if (!project) return;
    setProject((prev) =>
      prev
        ? {
            ...prev,
            milestones: prev.milestones.map((m) =>
              m.id === milestoneId ? { ...m, isCompleted } : m
            ),
          }
        : prev
    );

    await toggleProjectMilestone(project.workspaceId, milestoneId, isCompleted);
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!project) return;
    setProject((prev) =>
      prev
        ? { ...prev, milestones: prev.milestones.filter((m) => m.id !== milestoneId) }
        : prev
    );
    await deleteProjectMilestone(project.workspaceId, milestoneId);
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName.trim() || !project) return;
    setIsSubmittingSprint(true);

    try {
      const res = await createSprint({
        workspaceId: project.workspaceId,
        projectId: project.id,
        name: newSprintName.trim(),
        goal: newSprintGoal.trim() || undefined,
        startDate: newSprintStart || undefined,
        endDate: newSprintEnd || undefined,
      });

      if (res.success) {
        setIsCreateSprintOpen(false);
        setNewSprintName("");
        setNewSprintGoal("");
        setNewSprintStart("");
        setNewSprintEnd("");
        loadProject();
      }
    } finally {
      setIsSubmittingSprint(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsSavingSettings(true);

    try {
      await updateWorkspaceProject(project.workspaceId, project.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory.trim() || undefined,
        type: editType,
        targetDate: editTargetDate || undefined,
      });
      loadProject();
      alert("Project settings updated successfully.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    if (confirm(`Archive project "${project.name}"? It can be restored at any time.`)) {
      await archiveWorkspaceProject(project.workspaceId, project.id);
      loadProject();
    }
  };

  const handleRestore = async () => {
    if (!project) return;
    await restoreWorkspaceProject(project.workspaceId, project.id);
    loadProject();
  };

  const handleDelete = async () => {
    if (!project) return;
    if (confirm(`Permanently delete project "${project.name}"? This action cannot be undone.`)) {
      await deleteWorkspaceProject(project.workspaceId, project.id);
      router.push("/projects");
    }
  };

  const handleAddMember = async () => {
    if (!project || !selectedMemberToAdd) return;
    await addProjectMember(project.workspaceId, project.id, selectedMemberToAdd);
    setIsAddMemberOpen(false);
    setSelectedMemberToAdd("");
    loadProject();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!project) return;
    if (confirm("Remove this member from the project?")) {
      await removeProjectMember(project.workspaceId, project.id, userId);
      loadProject();
    }
  };

  // Filter tasks based on search
  const filteredTasks = useMemo(() => {
    if (!taskSearchQuery.trim()) return tasks;
    const q = taskSearchQuery.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.issueKey?.toLowerCase().includes(q) ||
        t.assigneeName?.toLowerCase().includes(q)
    );
  }, [tasks, taskSearchQuery]);

  // Dynamically determine eligible assignees for the project
  const eligibleAssignees = useMemo(() => {
    if (!project) return [];
    if (project.type === "PRIVATE") {
      return project.members;
    }
    // For PUBLIC projects, all workspace members can be assigned
    return workspaceMembers.map((m) => ({
      userId: m.userId,
      fullName: m.user?.fullName || m.user?.email || "Member",
      avatarUrl: m.user?.avatarUrl || null,
      email: m.user?.email || "",
    }));
  }, [project, workspaceMembers]);

  if (isLoading) {
    return (
      <ShellLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--spark-accent)]" />
        </div>
      </ShellLayout>
    );
  }

  if (!project) {
    return (
      <ShellLayout>
        <div className="p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-[var(--spark-text-primary)]">Project Not Found</h2>
          <p className="text-xs text-[var(--spark-text-secondary)]">
            The project [{projectKey}] does not exist in this workspace or you do not have permission to view it.
          </p>
          <Link href="/projects">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Projects
            </Button>
          </Link>
        </div>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout>
      <div className="space-y-5">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--spark-border)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--spark-text-muted)]">
              <Link href="/projects" className="hover:text-[var(--spark-text-primary)] transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Projects</span>
              </Link>
              <span>/</span>
              <span className="font-mono font-bold text-[var(--spark-text-primary)]">{project.key}</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-[var(--spark-text-primary)]">
                {project.name}
              </h1>

              <span className="px-2 py-0.5 rounded-[5px] bg-[var(--spark-highlight)] border border-[var(--spark-border)] text-xs font-mono font-bold text-[var(--spark-accent)]">
                {project.key}
              </span>

              {project.category && (
                <span className="px-2 py-0.5 rounded-[5px] bg-[var(--spark-surface)] border border-[var(--spark-border)] text-xs font-medium text-[var(--spark-text-secondary)]">
                  {project.category}
                </span>
              )}

              <Badge variant={project.type === "PRIVATE" ? "warning" : "default"} size="sm">
                {project.type === "PRIVATE" ? <Lock className="h-3 w-3 mr-1 inline" /> : <Globe className="h-3 w-3 mr-1 inline" />}
                {project.type}
              </Badge>

              <Badge
                variant={
                  project.status === "ACTIVE"
                    ? "violet"
                    : project.status === "COMPLETED"
                    ? "success"
                    : project.status === "ARCHIVED"
                    ? "error"
                    : "default"
                }
                size="sm"
              >
                {project.status}
              </Badge>

              {project.isOverdue && (
                <span className="px-2 py-0.5 rounded-[5px] bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Overdue
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateIssueOpen(true)}
            >
              Add Issue
            </Button>

            {project.status === "ARCHIVED" ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="h-3.5 w-3.5 text-emerald-500" />}
                onClick={handleRestore}
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Archive className="h-3.5 w-3.5 text-zinc-500" />}
                onClick={handleArchive}
              >
                Archive
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--spark-border)] overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "work-items", label: `Work Items (${tasks.length})`, icon: ListTodo },
            { id: "sprints", label: `Sprints (${project.sprints.length})`, icon: Zap },
            { id: "timeline", label: "Timeline & Milestones", icon: Milestone },
            { id: "activity", label: "Activity Audit", icon: Activity },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
                  isActive
                    ? "border-[var(--spark-accent)] text-[var(--spark-accent)] bg-[var(--spark-highlight)]/40"
                    : "border-transparent text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:border-[var(--spark-border)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Real Database Telemetry Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">Progress</span>
                <div className="text-xl font-extrabold text-[var(--spark-accent)]">
                  {project.taskStats.completionPercentage}%
                </div>
                <div className="w-full bg-[var(--spark-surface-subtle)] h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${project.taskStats.completionPercentage}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">Total Issues</span>
                <div className="text-xl font-extrabold text-[var(--spark-text-primary)]">
                  {project.taskStats.total}
                </div>
                <span className="text-[10px] text-[var(--spark-text-secondary)]">Deliverables logged</span>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">Completed</span>
                <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {project.taskStats.done}
                </div>
                <span className="text-[10px] text-[var(--spark-text-secondary)]">Resolved issues</span>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">In Progress</span>
                <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                  {project.taskStats.inProgress}
                </div>
                <span className="text-[10px] text-[var(--spark-text-secondary)]">Active engineering</span>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">Overdue Tasks</span>
                <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                  {project.taskStats.overdue}
                </div>
                <span className="text-[10px] text-[var(--spark-text-secondary)]">Past due date</span>
              </div>

              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--spark-text-muted)]">Team Size</span>
                <div className="text-xl font-extrabold text-[var(--spark-text-primary)]">
                  {project.members.length}
                </div>
                <span className="text-[10px] text-[var(--spark-text-secondary)]">Assigned members</span>
              </div>
            </div>

            {/* Description & Target Dates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-4">
                <div className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-3">
                  <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">About this Project</h3>
                  <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {project.description || "No project description provided. Add goals and scope in Settings."}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-[var(--spark-text-muted)] pt-3 border-t border-[var(--spark-border)]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span>Start: {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span>Target: {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : "Not set"}</span>
                    </div>
                  </div>
                </div>

                {/* Milestones Card */}
                <div className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Milestone className="h-4 w-4 text-[var(--spark-accent)]" />
                      <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Project Milestones</h3>
                    </div>
                    <span className="text-xs text-[var(--spark-text-muted)]">
                      {project.milestones.filter((m) => m.isCompleted).length} / {project.milestones.length} completed
                    </span>
                  </div>

                  <form onSubmit={handleAddMilestone} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add key milestone (e.g. Beta Launch, Security Audit)..."
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                    <input
                      type="date"
                      value={newMilestoneDate}
                      onChange={(e) => setNewMilestoneDate(e.target.value)}
                      className="px-2 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                    <Button type="submit" size="sm" variant="primary" disabled={isAddingMilestone}>
                      Add
                    </Button>
                  </form>

                  <div className="space-y-2 pt-2">
                    {project.milestones.length === 0 ? (
                      <p className="text-xs text-[var(--spark-text-muted)] py-2">No milestones set for this project.</p>
                    ) : (
                      project.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]/50 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={m.isCompleted}
                              onChange={(e) => handleToggleMilestone(m.id, e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--spark-border)] accent-[var(--spark-accent)] cursor-pointer"
                            />
                            <span className={cn("font-medium", m.isCompleted && "line-through opacity-60")}>
                              {m.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-[var(--spark-text-muted)]">
                            {m.dueDate && <span>{new Date(m.dueDate).toLocaleDateString()}</span>}
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="p-1 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Project Members Card */}
              <div className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--spark-accent)]" />
                    <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Project Roster</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsAddMemberOpen(true)}>
                    + Add Member
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {project.members.map((m) => {
                    const isOwner = m.userId === project.ownerId;
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-2 rounded-[8px] hover:bg-[var(--spark-surface-subtle)] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Avatar name={m.fullName} size="sm" src={m.avatarUrl || undefined} />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                              <span>{m.fullName}</span>
                              {isOwner && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold uppercase">
                                  Lead
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--spark-text-muted)] truncate">{m.email}</div>
                          </div>
                        </div>

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.userId)}
                            className="text-xs text-[var(--spark-text-muted)] hover:text-rose-500 p-1"
                            title="Remove from project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: WORK ITEMS ================= */}
        {activeTab === "work-items" && (
          <div className="space-y-4">
            {/* View Switcher & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--spark-surface)] border border-[var(--spark-border)]">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-[6px] border border-[var(--spark-border)] p-0.5 bg-[var(--spark-canvas)]">
                  <button
                    type="button"
                    onClick={() => setWorkItemsView("board")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-[5px] text-xs font-semibold transition-all",
                      workItemsView === "board"
                        ? "bg-[var(--spark-surface)] text-[var(--spark-accent)] shadow-2xs"
                        : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                    )}
                  >
                    <Kanban className="h-3.5 w-3.5" />
                    <span>Board View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkItemsView("list")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-[5px] text-xs font-semibold transition-all",
                      workItemsView === "list"
                        ? "bg-[var(--spark-surface)] text-[var(--spark-accent)] shadow-2xs"
                        : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                    )}
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>List View</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--spark-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search issues..."
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none w-44 sm:w-56"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsCreateIssueOpen(true)}
              >
                Create Issue
              </Button>
            </div>

            {/* View A: Kanban Board */}
            {workItemsView === "board" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.key);
                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, col.key)}
                      className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/40 p-3 flex flex-col min-h-[500px]"
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--spark-border)]">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", col.dotColor)} />
                          <h4 className="text-xs font-bold text-[var(--spark-text-primary)]">{col.label}</h4>
                        </div>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)]">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="space-y-2 flex-1">
                        {colTasks.map((t) => {
                          const typeConfig = ISSUE_TYPE_CONFIG[t.type] || ISSUE_TYPE_CONFIG.TASK;
                          const TypeIcon = typeConfig.icon;
                          return (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, t.id)}
                              onClick={() => {
                                setSelectedTaskForDrawer(t);
                                setIsDrawerOpen(true);
                              }}
                              className="p-3 rounded-[9px] bg-[var(--spark-surface)] border border-[var(--spark-border)] hover:border-[var(--spark-accent)]/50 shadow-2xs hover:shadow-card transition-all cursor-grab active:cursor-grabbing space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1">
                                  <TypeIcon className={cn("h-3 w-3", typeConfig.color)} />
                                  <span className="font-mono font-semibold text-[var(--spark-accent)]">
                                    {t.issueKey || "ISSUE"}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                                    t.priority === "URGENT" && "bg-rose-500/10 text-rose-600",
                                    t.priority === "HIGH" && "bg-amber-500/10 text-amber-600",
                                    t.priority === "MEDIUM" && "bg-blue-500/10 text-blue-600",
                                    t.priority === "LOW" && "bg-zinc-500/10 text-zinc-600"
                                  )}
                                >
                                  {t.priority}
                                </span>
                              </div>

                              <p className="text-xs font-semibold text-[var(--spark-text-primary)] line-clamp-2">
                                {t.title}
                              </p>

                              <div className="flex items-center justify-between pt-1 border-t border-[var(--spark-border)] text-[10px] text-[var(--spark-text-muted)]">
                                <div>
                                  {t.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                                <Avatar name={t.assigneeName || "Unassigned"} size="sm" src={t.assigneeAvatar || undefined} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View B: Tabular List */}
            {workItemsView === "list" && (
              <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--spark-surface-subtle)]/70 text-[var(--spark-text-secondary)] border-b border-[var(--spark-border)] text-[11px] font-semibold">
                    <tr>
                      <th className="p-3">Key</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Summary</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Assignee</th>
                      <th className="p-3">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--spark-border)]">
                    {filteredTasks.map((t) => {
                      const typeConfig = ISSUE_TYPE_CONFIG[t.type] || ISSUE_TYPE_CONFIG.TASK;
                      const TypeIcon = typeConfig.icon;
                      return (
                        <tr
                          key={t.id}
                          onClick={() => {
                            setSelectedTaskForDrawer(t);
                            setIsDrawerOpen(true);
                          }}
                          className="hover:bg-[var(--spark-surface-subtle)]/40 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-semibold text-[var(--spark-accent)]">{t.issueKey}</td>
                          <td className="p-3">
                            <span className="flex items-center gap-1">
                              <TypeIcon className={cn("h-3 w-3", typeConfig.color)} />
                              <span className="capitalize">{typeConfig.label}</span>
                            </span>
                          </td>
                          <td className="p-3 font-medium text-[var(--spark-text-primary)] max-w-xs truncate">{t.title}</td>
                          <td className="p-3">
                            <Badge variant="default" size="sm">{t.status}</Badge>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-[11px]">{t.priority}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Avatar name={t.assigneeName || "Unassigned"} size="sm" src={t.assigneeAvatar || undefined} />
                              <span>{t.assigneeName || "Unassigned"}</span>
                            </div>
                          </td>
                          <td className="p-3 text-[var(--spark-text-muted)]">
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: SPRINTS ================= */}
        {activeTab === "sprints" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Sprint Management</h3>
                <p className="text-xs text-[var(--spark-text-secondary)]">
                  Organize iterations, sprint milestones, and agile velocity.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsCreateSprintOpen(true)}
              >
                Create Sprint
              </Button>
            </div>

            <div className="space-y-4">
              {project.sprints.length === 0 ? (
                <EmptyState
                  icon={<Zap className="h-6 w-6" />}
                  title="No Sprints Yet"
                  description="Plan your first iteration by creating a sprint."
                />
              ) : (
                project.sprints.map((s) => {
                  const sprintTasks = tasks.filter((t) => t.sprintId === s.id);
                  const doneCount = sprintTasks.filter((t) => t.status === "DONE").length;
                  const pct = sprintTasks.length > 0 ? Math.round((doneCount / sprintTasks.length) * 100) : 0;

                  return (
                    <div
                      key={s.id}
                      className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[var(--spark-text-primary)]">{s.name}</h4>
                            <Badge
                              variant={s.status === "ACTIVE" ? "violet" : s.status === "COMPLETED" ? "success" : "default"}
                              size="sm"
                            >
                              {s.status}
                            </Badge>
                          </div>
                          {s.goal && <p className="text-xs text-[var(--spark-text-secondary)]">{s.goal}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          {s.status === "PLANNED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await updateSprintStatus(project.workspaceId, s.id, "ACTIVE");
                                loadProject();
                              }}
                            >
                              Start Sprint
                            </Button>
                          )}
                          {s.status === "ACTIVE" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                await updateSprintStatus(project.workspaceId, s.id, "COMPLETED");
                                loadProject();
                              }}
                            >
                              Complete Sprint
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--spark-text-muted)]">
                          <span>Progress ({doneCount}/{sprintTasks.length} tasks)</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-[var(--spark-surface-subtle)] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Sprint task chips */}
                      <div className="pt-2 flex flex-wrap gap-2">
                        {sprintTasks.map((st) => (
                          <div
                            key={st.id}
                            onClick={() => {
                              setSelectedTaskForDrawer(st);
                              setIsDrawerOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] hover:border-[var(--spark-accent)] text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="font-mono font-bold text-[var(--spark-accent)]">{st.issueKey}</span>
                            <span className="truncate max-w-[150px]">{st.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: TIMELINE & MILESTONES ================= */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Roadmap &amp; Delivery Timeline</h3>
              <p className="text-xs text-[var(--spark-text-secondary)]">
                Chronological delivery view based on issue start and due dates.
              </p>

              <div className="space-y-3 pt-2">
                {tasks.filter((t) => t.dueDate).length === 0 ? (
                  <p className="text-xs text-[var(--spark-text-muted)]">No tasks with due dates assigned yet.</p>
                ) : (
                  tasks
                    .filter((t) => t.dueDate)
                    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                    .map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTaskForDrawer(t);
                          setIsDrawerOpen(true);
                        }}
                        className="flex items-center justify-between p-3 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] hover:border-[var(--spark-accent)] cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--spark-accent)]">{t.issueKey}</span>
                          <span className="font-semibold text-[var(--spark-text-primary)]">{t.title}</span>
                          <Badge variant="default" size="sm">{t.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-[var(--spark-text-muted)]">
                          <span>Due: {new Date(t.dueDate!).toLocaleDateString()}</span>
                          <Avatar name={t.assigneeName || "Unassigned"} size="sm" src={t.assigneeAvatar || undefined} />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: ACTIVITY AUDIT ================= */}
        {activeTab === "activity" && (
          <div className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Project Activity Log</h3>
            <div className="space-y-3">
              {project.recentActivities.length === 0 ? (
                <p className="text-xs text-[var(--spark-text-muted)] py-4">No activity recorded yet.</p>
              ) : (
                project.recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs pb-3 border-b border-[var(--spark-border)]">
                    <Avatar name={act.userName} size="sm" src={act.userAvatar || undefined} />
                    <div className="flex-1 space-y-0.5">
                      <div className="text-[var(--spark-text-primary)]">
                        <strong>{act.userName}</strong>{" "}
                        <span className="text-[var(--spark-text-secondary)]">
                          {act.action === "STATUS_CHANGED" && `changed status from ${act.oldValue} to ${act.newValue}`}
                          {act.action === "ASSIGNED" && `assigned ${act.newValue}`}
                          {act.action === "PRIORITY_CHANGED" && `changed priority to ${act.newValue}`}
                          {act.action === "CREATED" && act.newValue}
                          {act.action === "COMMENT_ADDED" && `commented: "${act.newValue}"`}
                        </span>{" "}
                        {act.taskKey && <span className="font-mono font-bold text-[var(--spark-accent)]">[{act.taskKey}]</span>}
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

        {/* ================= TAB 6: SETTINGS ================= */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <form onSubmit={handleSaveSettings} className="p-5 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">General Settings</h3>

              <div>
                <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Infrastructure, Mobile, AI Platform"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">Visibility</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                  >
                    <option value="PUBLIC">Public (All workspace members)</option>
                    <option value="PRIVATE">Private (Only project members)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="sm" disabled={isSavingSettings}>
                  Save Changes
                </Button>
              </div>
            </form>

            <div className="p-5 rounded-[12px] bg-rose-500/5 border border-rose-500/20 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">Danger Zone</h3>
              <p className="text-[var(--spark-text-secondary)]">
                Archive or permanently delete this project.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleArchive}>Archive Project</Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Project</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Issue Modal */}
      {isCreateIssueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] shadow-2xl p-6 space-y-4 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--spark-border)] pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white uppercase shadow-2xs"
                  style={{ backgroundColor: project.color || "#7C3AED" }}
                >
                  {project.key}
                </span>
                <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">
                  Add Issue to [{project.key}]
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateIssueOpen(false)}
                className="text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] transition cursor-pointer p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {issueFormError && (
              <div className="p-3 rounded-[8px] bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{issueFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateIssue} className="space-y-3.5">
              {/* Summary */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                  Summary / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement OAuth2 Session Refresh Strategy"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)] font-medium"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                  Description / Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  placeholder="User story narrative, technical specs, or reproduction steps..."
                  value={newIssueDescription}
                  onChange={(e) => setNewIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)] resize-y"
                />
              </div>

              {/* Type, Priority, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Issue Type
                  </label>
                  <select
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="TASK">Task (Deliverable)</option>
                    <option value="BUG">Bug (Defect)</option>
                    <option value="STORY">Story (User Feature)</option>
                    <option value="EPIC">Epic (Initiative)</option>
                    <option value="SUBTASK">Subtask (Step)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={newIssuePriority}
                    onChange={(e) => setNewIssuePriority(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent / Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newIssueStatus}
                    onChange={(e) => setNewIssueStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] font-medium focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="BACKLOG">Backlog</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>

              {/* Assignee, Sprint, Story Points */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Assignee
                  </label>
                  <select
                    value={newIssueAssigneeId}
                    onChange={(e) => setNewIssueAssigneeId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="">Unassigned</option>
                    {eligibleAssignees.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.fullName}</option>
                    ))}
                  </select>
                  {project.type === "PRIVATE" ? (
                    <span className="text-[10px] text-amber-500 font-medium mt-1 block">
                      🔒 Only {eligibleAssignees.length} private member{eligibleAssignees.length === 1 ? "" : "s"} can be assigned
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--spark-text-muted)] mt-1 block">
                      🌐 Public initiative: All {workspaceMembers.length} members eligible
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Sprint
                  </label>
                  <select
                    value={newIssueSprintId}
                    onChange={(e) => setNewIssueSprintId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="">No Sprint (Backlog)</option>
                    {project.sprints?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Story Points (Fibonacci)
                  </label>
                  <select
                    value={newIssueStoryPoints}
                    onChange={(e) =>
                      setNewIssueStoryPoints(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  >
                    <option value="">None (Unestimated)</option>
                    <option value="1">1 pt</option>
                    <option value="2">2 pts</option>
                    <option value="3">3 pts</option>
                    <option value="5">5 pts</option>
                    <option value="8">8 pts</option>
                    <option value="13">13 pts</option>
                  </select>
                </div>
              </div>

              {/* Start Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newIssueStartDate}
                    onChange={(e) => setNewIssueStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                    Target / Due Date
                  </label>
                  <input
                    type="date"
                    value={newIssueDueDate}
                    onChange={(e) => setNewIssueDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                  />
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--spark-text-secondary)] mb-1">
                  Labels (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. backend, security, api"
                  value={newIssueLabels}
                  onChange={(e) => setNewIssueLabels(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] focus:outline-none focus:border-[var(--spark-accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateIssueOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingIssue || !newIssueTitle.trim()}
                >
                  {isSubmittingIssue ? "Creating..." : "Create Work Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sprint Modal */}
      {isCreateSprintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] shadow-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Create Sprint for [{project.key}]</h3>
            <form onSubmit={handleCreateSprint} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Sprint Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 1 - Core Flow"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sprint Goal</label>
                <textarea
                  rows={2}
                  placeholder="What is the objective of this sprint?"
                  value={newSprintGoal}
                  onChange={(e) => setNewSprintGoal(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newSprintStart}
                    onChange={(e) => setNewSprintStart(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={newSprintEnd}
                    onChange={(e) => setNewSprintEnd(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--spark-border)]">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateSprintOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmittingSprint}>Create Sprint</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] shadow-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[var(--spark-text-primary)]">Add Team Member to Project</h3>
            <select
              value={selectedMemberToAdd}
              onChange={(e) => setSelectedMemberToAdd(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] focus:outline-none"
            >
              <option value="">Select workspace colleague...</option>
              {workspaceMembers
                .filter((wm) => !project.members.some((pm) => pm.userId === wm.userId))
                .map((wm) => (
                  <option key={wm.userId} value={wm.userId}>
                    {wm.user.fullName} ({wm.user.email})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--spark-border)]">
              <Button variant="outline" size="sm" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAddMember} disabled={!selectedMemberToAdd}>Add</Button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Drawer */}
      <TaskDetailsDrawer
        task={selectedTaskForDrawer}
        workspaceId={project.workspaceId}
        members={workspaceMembers}
        projects={[project]}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTaskForDrawer(null);
        }}
        onTaskUpdated={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
        onTaskDeleted={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        }}
      />
    </ShellLayout>
  );
}

export default function ProjectDetailsPage() {
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
      <ProjectDetailsContent />
    </React.Suspense>
  );
}
