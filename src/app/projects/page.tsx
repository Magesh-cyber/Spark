"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  MoreVertical,
  Trash2,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Layers,
  X,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceProjects,
  createWorkspaceProject,
  updateWorkspaceProject,
  deleteWorkspaceProject,
  ProjectRecordItem,
} from "@/lib/actions/projects";

const COLOR_PRESETS = [
  { name: "Purple", hex: "#7C3AED" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Cyan", hex: "#0891B2" },
  { name: "Emerald", hex: "#059669" },
  { name: "Amber", hex: "#D97706" },
  { name: "Rose", hex: "#E11D48" },
  { name: "Indigo", hex: "#4F46E5" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const { activeWorkspace, currentUser } = useWorkspace();

  const [projects, setProjects] = useState<ProjectRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ON_HOLD" | "COMPLETED">("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [hasManuallyEditedKey, setHasManuallyEditedKey] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0].hex);
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Load projects
  const loadProjects = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getWorkspaceProjects(activeWorkspace.id);
      if (res.success && res.projects) {
        setProjects(res.projects);
      }
    } catch (err) {
      console.error("Failed to load workspace projects:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Handle auto key generation
  const handleNameChange = (val: string) => {
    setName(val);
    if (!hasManuallyEditedKey) {
      const words = val.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const generated = words.map((w) => w[0].toUpperCase()).join("").slice(0, 4);
        setKey(generated);
      } else {
        const clean = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
        setKey(clean);
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspace?.id) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createWorkspaceProject({
        workspaceId: activeWorkspace.id,
        name: name.trim(),
        key: key.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        color: selectedColor,
        targetDate: targetDate || undefined,
      });

      if (res.success && res.project) {
        setProjects((prev) => [res.project!, ...prev]);
        setIsCreateOpen(false);
        setName("");
        setKey("");
        setDescription("");
        setTargetDate("");
        setHasManuallyEditedKey(false);
      } else {
        setErrorMsg(res.error || "Failed to create project.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: "ACTIVE" | "ON_HOLD" | "COMPLETED") => {
    if (!activeWorkspace?.id) return;
    setActiveMenuId(null);

    // Optimistic
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
    );

    await updateWorkspaceProject(activeWorkspace.id, projectId, { status: newStatus });
  };

  const handleDelete = async (projectId: string) => {
    if (!activeWorkspace?.id) return;
    if (!confirm("Are you sure you want to delete this project? Associated issues will remain in the workspace.")) {
      return;
    }
    setActiveMenuId(null);

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    await deleteWorkspaceProject(activeWorkspace.id, projectId);
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "ACTIVE").length;
    const totalIssues = projects.reduce((acc, p) => acc + p.taskStats.total, 0);
    const completedIssues = projects.reduce((acc, p) => acc + p.taskStats.done, 0);
    const overallRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return { total, active, totalIssues, completedIssues, overallRate };
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <ShellLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <PageHeader
          title="Projects"
          description={`Track initiatives, sprint deliverables, and Jira boards for ${
            activeWorkspace?.name || "your organization"
          }.`}
          badge={
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--spark-primary)]/10 text-[var(--spark-primary)] border border-[var(--spark-primary)]/20">
              {projects.length} Initiatives
            </span>
          }
          actions={
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[var(--spark-primary)] text-white text-xs sm:text-sm font-medium shadow-sm hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Project</span>
            </button>
          }
        />

        {/* Top KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--spark-text-secondary)]">
                Total Projects
              </span>
              <div className="h-8 w-8 rounded-lg bg-[var(--spark-primary)]/10 flex items-center justify-center text-[var(--spark-primary)]">
                <FolderKanban className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--spark-text-primary)]">
              {kpis.total}
            </div>
            <p className="mt-1 text-[11px] text-[var(--spark-text-muted)]">
              {kpis.active} actively in progress
            </p>
          </div>

          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--spark-text-secondary)]">
                Tracked Issues
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--spark-text-primary)]">
              {kpis.totalIssues}
            </div>
            <p className="mt-1 text-[11px] text-[var(--spark-text-muted)]">
              Across all boards & backlogs
            </p>
          </div>

          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--spark-text-secondary)]">
                Completed Issues
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--spark-text-primary)]">
              {kpis.completedIssues}
            </div>
            <p className="mt-1 text-[11px] text-[var(--spark-text-muted)]">
              Resolved deliverables
            </p>
          </div>

          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--spark-text-secondary)]">
                Delivery Rate
              </span>
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--spark-text-primary)]">
              {kpis.overallRate}%
            </div>
            <div className="mt-2 w-full bg-[var(--spark-border-subtle)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${kpis.overallRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--spark-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name or key (e.g. CORE)..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-primary)] placeholder-[var(--spark-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-primary)] transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(["ALL", "ACTIVE", "ON_HOLD", "COMPLETED"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-[7px] text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab
                    ? "bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] shadow-xs border border-[var(--spark-border)]"
                    : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
              >
                {tab === "ALL"
                  ? "All Projects"
                  : tab === "ACTIVE"
                  ? "Active"
                  : tab === "ON_HOLD"
                  ? "On Hold"
                  : "Completed"}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-12">
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-[var(--spark-primary)]" />}
              title={searchQuery ? "No matching projects" : "No projects created yet"}
              description={
                searchQuery
                  ? `No project matched "${searchQuery}". Try a different keyword.`
                  : "Get started by organizing your initiatives with dedicated Jira-style projects, auto-generated issue keys, and Kanban boards."
              }
              actionLabel={!searchQuery ? "Create First Project" : undefined}
              onAction={!searchQuery ? () => setIsCreateOpen(true) : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => {
              const targetDateFormatted = p.targetDate
                ? new Date(p.targetDate).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : null;

              return (
                <div
                  key={p.id}
                  className="group relative rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] hover:border-[var(--spark-border-hover)] hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden"
                >
                  {/* Color accent strip */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: p.color || "#7C3AED" }}
                  />

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Row: Key badge, Status, and Options Menu */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-[5px] text-[11px] font-mono font-bold uppercase tracking-wider text-white shadow-2xs"
                            style={{ backgroundColor: p.color || "#7C3AED" }}
                          >
                            {p.key}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : p.status === "ON_HOLD"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-500"
                                  : p.status === "ON_HOLD"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            {p.status === "ACTIVE"
                              ? "Active"
                              : p.status === "ON_HOLD"
                              ? "On Hold"
                              : "Completed"}
                          </span>
                        </div>

                        {/* Menu dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === p.id ? null : p.id))
                            }
                            className="p-1 rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === p.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95">
                              <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--spark-text-muted)] uppercase tracking-wider">
                                Set Status
                              </div>
                              <button
                                onClick={() => handleStatusChange(p.id, "ACTIVE")}
                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2"
                              >
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                                Active
                              </button>
                              <button
                                onClick={() => handleStatusChange(p.id, "ON_HOLD")}
                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2"
                              >
                                <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                                On Hold
                              </button>
                              <button
                                onClick={() => handleStatusChange(p.id, "COMPLETED")}
                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                                Completed
                              </button>

                              <div className="my-1 border-t border-[var(--spark-border-subtle)]" />
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Project
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Project Title & Description */}
                      <h3 className="text-base font-semibold text-[var(--spark-text-primary)] line-clamp-1 group-hover:text-[var(--spark-primary)] transition-colors">
                        {p.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--spark-text-secondary)] line-clamp-2 min-h-[2rem]">
                        {p.description || "No description provided for this project."}
                      </p>
                    </div>

                    {/* Meta info & Progress */}
                    <div className="mt-5 space-y-3.5 pt-3 border-t border-[var(--spark-border-subtle)]">
                      {/* Lead and Date */}
                      <div className="flex items-center justify-between text-xs text-[var(--spark-text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          {p.ownerAvatar ? (
                            <img
                              src={p.ownerAvatar}
                              alt={p.ownerName}
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-4 w-4 rounded-full bg-[var(--spark-primary)]/20 text-[var(--spark-primary)] flex items-center justify-center text-[9px] font-bold">
                              {p.ownerName?.[0]?.toUpperCase() || "L"}
                            </div>
                          )}
                          <span className="truncate max-w-[110px]">{p.ownerName}</span>
                        </div>

                        {targetDateFormatted ? (
                          <div className="flex items-center gap-1 text-[var(--spark-text-muted)]">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{targetDateFormatted}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--spark-text-muted)]">No deadline</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[var(--spark-text-muted)] text-[11px]">
                            {p.taskStats.done} of {p.taskStats.total} issues completed
                          </span>
                          <span className="font-semibold text-[var(--spark-text-primary)] text-[11px]">
                            {p.taskStats.completionPercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--spark-border-subtle)] h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${p.taskStats.completionPercentage}%`,
                              backgroundColor: p.color || "#7C3AED",
                            }}
                          />
                        </div>
                      </div>

                      {/* Jira Issue breakdown pills */}
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--spark-text-muted)] flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--spark-surface-subtle)] border border-[var(--spark-border-subtle)]">
                          {p.taskStats.todo} To Do
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {p.taskStats.inProgress} In Dev
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          {p.taskStats.inReview} Review
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {p.taskStats.done} Done
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer CTA */}
                  <div className="px-5 py-3 bg-[var(--spark-surface-subtle)] border-t border-[var(--spark-border)] flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[var(--spark-text-muted)]">
                      Prefix: {p.key}-#
                    </span>
                    <Link
                      href={`/tasks?project=${p.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--spark-primary)] hover:text-[var(--spark-primary-hover)] transition-colors"
                    >
                      <span>Open Board</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Project Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div
              className="relative w-full max-w-lg rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--spark-border)]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[var(--spark-primary)]/10 text-[var(--spark-primary)] flex items-center justify-center">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
                      Create Jira Project
                    </h2>
                    <p className="text-xs text-[var(--spark-text-secondary)]">
                      Define a project workspace with auto-generated issue keys.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Core Infrastructure or Mobile App"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                      Project Key *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={key}
                      onChange={(e) => {
                        setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                        setHasManuallyEditedKey(true);
                      }}
                      placeholder="e.g. CORE"
                      className="w-full px-3 py-2 text-xs sm:text-sm font-mono uppercase font-bold rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-primary)]"
                    />
                    <span className="text-[10px] text-[var(--spark-text-muted)]">
                      Prefix for issues (e.g. {key || "KEY"}-1)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                      Target Completion Date
                    </label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly state the goal, scope, and objectives of this initiative..."
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-primary)] resize-none"
                  />
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        className={`h-7 w-7 rounded-full transition-transform ${
                          selectedColor === c.hex ? "scale-115 ring-2 ring-offset-2 ring-[var(--spark-primary)]" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--spark-border)] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3.5 py-2 rounded-[8px] text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="px-4 py-2 rounded-[8px] bg-[var(--spark-primary)] text-white text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
                  >
                    {isSubmitting ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}