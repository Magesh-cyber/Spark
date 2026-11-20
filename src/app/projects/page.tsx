"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Globe,
  Lock,
  Users,
  Check,
  UserCheck,
  X,
  Archive,
  RotateCcw,
  Tag,
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceProjects,
  createWorkspaceProject,
  updateWorkspaceProject,
  deleteWorkspaceProject,
  archiveWorkspaceProject,
  restoreWorkspaceProject,
  ProjectRecordItem,
  ProjectMetricsSummary,
} from "@/lib/actions/projects";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { WorkspaceMemberItem } from "@/lib/types";

const COLOR_PRESETS = [
  { name: "Purple", hex: "#7C3AED" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Cyan", hex: "#0891B2" },
  { name: "Emerald", hex: "#059669" },
  { name: "Amber", hex: "#D97706" },
  { name: "Rose", hex: "#E11D48" },
  { name: "Indigo", hex: "#4F46E5" },
];

const CATEGORY_PRESETS = [
  "Engineering",
  "Infrastructure",
  "Product & Design",
  "AI & Machine Learning",
  "Customer Operations",
  "Marketing & Growth",
  "Security & Compliance",
];

const SORT_OPTIONS: {
  key: "NEWEST" | "DUE_DATE" | "PROGRESS" | "NAME";
  label: string;
}[] = [
  { key: "NEWEST", label: "Newest" },
  { key: "DUE_DATE", label: "Target Date" },
  { key: "PROGRESS", label: "Progress %" },
  { key: "NAME", label: "Name (A–Z)" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const { activeWorkspace, currentUser } = useWorkspace();

  const [projects, setProjects] = useState<ProjectRecordItem[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetricsSummary | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED"
  >("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "DUE_DATE" | "PROGRESS" | "NAME">("NEWEST");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSortOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSortOpen]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [hasManuallyEditedKey, setHasManuallyEditedKey] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Engineering");
  const [initialStatus, setInitialStatus] = useState<"PLANNING" | "ACTIVE">("ACTIVE");
  const [projectType, setProjectType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0].hex);
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Dropdown Menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close 3-dots project dropdown menu when clicking outside
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-project-menu]")) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuId]);

  // Load projects and workspace members
  const loadData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setProjects([]);
      setMembers([]);
      setMetrics(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [projRes, memRes] = await Promise.all([
        getWorkspaceProjects(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
      ]);

      if (projRes.success && projRes.projects) {
        setProjects(projRes.projects);
        if (projRes.metrics) setMetrics(projRes.metrics);
      }
      if (memRes.members) {
        setMembers(memRes.members);
      }
    } catch (err) {
      console.error("Failed to load workspace projects or members:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ensure current user is in selected members when modal opens
  useEffect(() => {
    if (isCreateOpen && currentUser?.id) {
      setSelectedMemberIds((prev) => {
        if (!prev.includes(currentUser.id)) {
          return [currentUser.id, ...prev];
        }
        return prev;
      });
    }
  }, [isCreateOpen, currentUser?.id]);

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

  const toggleMemberSelection = (userId: string) => {
    if (userId === currentUser?.id) return; // Cannot unselect the creator

    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
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
        category: category.trim() || undefined,
        type: projectType,
        memberIds: projectType === "PRIVATE" ? selectedMemberIds : undefined,
        color: selectedColor,
        targetDate: targetDate || undefined,
      });

      if (res.success && res.project) {
        setProjects((prev) => [res.project!, ...prev]);
        setIsCreateOpen(false);
        setName("");
        setKey("");
        setDescription("");
        setCategory("Engineering");
        setProjectType("PUBLIC");
        setSelectedMemberIds(currentUser?.id ? [currentUser.id] : []);
        setTargetDate("");
        setHasManuallyEditedKey(false);
        loadData(); // Refresh metrics
      } else {
        setErrorMsg(res.error || "Failed to create project.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    projectId: string,
    newStatus: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED"
  ) => {
    if (!activeWorkspace?.id) return;
    setActiveMenuId(null);

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
    );

    await updateWorkspaceProject(activeWorkspace.id, projectId, { status: newStatus });
    loadData();
  };

  const handleArchive = async (projectId: string) => {
    if (!activeWorkspace?.id) return;
    setActiveMenuId(null);
    await archiveWorkspaceProject(activeWorkspace.id, projectId);
    loadData();
  };

  const handleRestore = async (projectId: string) => {
    if (!activeWorkspace?.id) return;
    setActiveMenuId(null);
    await restoreWorkspaceProject(activeWorkspace.id, projectId);
    loadData();
  };

  const handleDelete = async (projectId: string) => {
    if (!activeWorkspace?.id) return;
    if (
      !confirm(
        "Are you sure you want to permanently delete this project? Associated work items will remain in the workspace."
      )
    ) {
      return;
    }
    setActiveMenuId(null);

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    await deleteWorkspaceProject(activeWorkspace.id, projectId);
    loadData();
  };

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    const list = projects.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchVisibility = visibilityFilter === "ALL" || p.type === visibilityFilter;

      return matchSearch && matchStatus && matchVisibility;
    });

    return list.sort((a, b) => {
      if (sortBy === "DUE_DATE") {
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      if (sortBy === "PROGRESS") {
        return b.taskStats.completionPercentage - a.taskStats.completionPercentage;
      }
      if (sortBy === "NAME") {
        return a.name.localeCompare(b.name);
      }
      // NEWEST default
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [projects, searchQuery, statusFilter, visibilityFilter, sortBy]);

  // Filtered members for private project picker
  const filteredModalMembers = useMemo(() => {
    return members.filter((m) => {
      if (!memberSearchQuery.trim()) return true;
      const q = memberSearchQuery.toLowerCase();
      return (
        m.user.fullName?.toLowerCase().includes(q) ||
        m.user.email?.toLowerCase().includes(q)
      );
    });
  }, [members, memberSearchQuery]);

  // Computed display metrics
  const displayMetrics = useMemo(() => {
    if (metrics) return metrics;

    const total = projects.length;
    const active = projects.filter((p) => p.status === "ACTIVE").length;
    const onHold = projects.filter((p) => p.status === "ON_HOLD").length;
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const now = new Date();
    const overdue = projects.filter(
      (p) => p.targetDate && new Date(p.targetDate) < now && p.status !== "COMPLETED"
    ).length;
    const totalIssues = projects.reduce((acc, p) => acc + p.taskStats.total, 0);
    const completedIssues = projects.reduce((acc, p) => acc + p.taskStats.done, 0);
    const overallDeliveryRate =
      totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return {
      totalProjects: total,
      activeProjects: active,
      onHoldProjects: onHold,
      completedProjects: completed,
      overdueProjects: overdue,
      totalIssues,
      completedIssues,
      overallDeliveryRate,
    };
  }, [metrics, projects]);

  return (
    <ShellLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <PageHeader
          title="Projects & Initiatives"
          description={`Central organizational portfolio, deliverable roadmaps, and key-prefixed project execution for ${
            activeWorkspace?.name || "your organization"
          }.`}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--spark-accent)]/10 text-[var(--spark-accent)] border border-[var(--spark-accent)]/20">
              {projects.length} Total Initiatives
            </span>
          }
          actions={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setErrorMsg(null);
                setProjectType("PUBLIC");
                setSelectedMemberIds(currentUser?.id ? [currentUser.id] : []);
                setIsCreateOpen(true);
              }}
            >
              Create Project
            </Button>
          }
        />

        {/* 8 Real Database-Backed Metrics Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* 1. Total Projects */}
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-xs">
            <span className="text-[11px] font-medium text-[var(--spark-text-muted)] block">
              Total Projects
            </span>
            <div className="mt-1 text-xl font-bold text-[var(--spark-text-primary)]">
              {displayMetrics.totalProjects}
            </div>
            <span className="text-[10px] text-[var(--spark-text-secondary)]">All initiatives</span>
          </div>

          {/* 2. Active Projects */}
          <div className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">
              Active
            </span>
            <div className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {displayMetrics.activeProjects}
            </div>
            <span className="text-[10px] text-emerald-600/70">In execution</span>
          </div>

          {/* 3. Projects on Hold */}
          <div className="rounded-[10px] border border-amber-500/20 bg-amber-500/5 p-3 shadow-xs">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">
              On Hold
            </span>
            <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
              {displayMetrics.onHoldProjects}
            </div>
            <span className="text-[10px] text-amber-600/70">Paused</span>
          </div>

          {/* 4. Completed Projects */}
          <div className="rounded-[10px] border border-blue-500/20 bg-blue-500/5 p-3 shadow-xs">
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 block">
              Completed
            </span>
            <div className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
              {displayMetrics.completedProjects}
            </div>
            <span className="text-[10px] text-blue-600/70">Delivered</span>
          </div>

          {/* 5. Overdue Projects */}
          <div
            className={`rounded-[10px] border p-3 shadow-xs ${
              displayMetrics.overdueProjects > 0
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-[var(--spark-border)] bg-[var(--spark-surface)]"
            }`}
          >
            <span
              className={`text-[11px] font-medium block ${
                displayMetrics.overdueProjects > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-[var(--spark-text-muted)]"
              }`}
            >
              Overdue
            </span>
            <div
              className={`mt-1 text-xl font-bold ${
                displayMetrics.overdueProjects > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-[var(--spark-text-primary)]"
              }`}
            >
              {displayMetrics.overdueProjects}
            </div>
            <span className="text-[10px] text-[var(--spark-text-muted)]">Past target</span>
          </div>

          {/* 6. Total Issues */}
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-xs">
            <span className="text-[11px] font-medium text-[var(--spark-text-muted)] block">
              Total Issues
            </span>
            <div className="mt-1 text-xl font-bold text-[var(--spark-text-primary)]">
              {displayMetrics.totalIssues}
            </div>
            <span className="text-[10px] text-[var(--spark-text-secondary)]">Work items</span>
          </div>

          {/* 7. Completed Issues */}
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 shadow-xs">
            <span className="text-[11px] font-medium text-[var(--spark-text-muted)] block">
              Resolved Issues
            </span>
            <div className="mt-1 text-xl font-bold text-[var(--spark-text-primary)]">
              {displayMetrics.completedIssues}
            </div>
            <span className="text-[10px] text-[var(--spark-text-secondary)]">Done</span>
          </div>

          {/* 8. Overall Delivery Rate */}
          <div className="rounded-[10px] border border-violet-500/20 bg-violet-500/5 p-3 shadow-xs">
            <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 block">
              Delivery Rate
            </span>
            <div className="mt-1 text-xl font-bold text-violet-700 dark:text-violet-300">
              {displayMetrics.overallDeliveryRate}%
            </div>
            <div className="mt-1.5 w-full bg-violet-200 dark:bg-violet-950/50 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-violet-600 dark:bg-violet-400 h-full rounded-full transition-all"
                style={{ width: `${displayMetrics.overallDeliveryRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter, Visibility, Search & Sort Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--spark-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, key (e.g. CLA), or category..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-primary)] placeholder-[var(--spark-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)] transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Visibility Filter */}
            <div className="flex items-center p-0.5 rounded-[8px] bg-[var(--spark-surface-subtle)] border border-[var(--spark-border)] text-xs">
              <button
                onClick={() => setVisibilityFilter("ALL")}
                className={`px-2.5 py-1 rounded-[6px] font-medium transition ${
                  visibilityFilter === "ALL"
                    ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] shadow-2xs"
                    : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                All Visibility
              </button>
              <button
                onClick={() => setVisibilityFilter("PUBLIC")}
                className={`px-2.5 py-1 rounded-[6px] font-medium flex items-center gap-1 transition ${
                  visibilityFilter === "PUBLIC"
                    ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] shadow-2xs"
                    : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                <Globe className="h-3 w-3" />
                <span>Public</span>
              </button>
              <button
                onClick={() => setVisibilityFilter("PRIVATE")}
                className={`px-2.5 py-1 rounded-[6px] font-medium flex items-center gap-1 transition ${
                  visibilityFilter === "PRIVATE"
                    ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] shadow-2xs"
                    : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                <Lock className="h-3 w-3 text-amber-500" />
                <span>Private</span>
              </button>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {(
                [
                  { key: "ALL", label: "All Status" },
                  { key: "ACTIVE", label: "Active" },
                  { key: "PLANNING", label: "Planning" },
                  { key: "ON_HOLD", label: "On Hold" },
                  { key: "COMPLETED", label: "Completed" },
                  { key: "ARCHIVED", label: "Archived" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1.5 rounded-[7px] text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab.key
                      ? "bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] shadow-xs border border-[var(--spark-border)] font-semibold"
                      : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Simplified & Lightweight Sort Dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium border transition-colors shadow-2xs select-none cursor-pointer ${
                  sortBy !== "NEWEST"
                    ? "border-[var(--spark-accent)] bg-[var(--spark-accent)]/10 text-[var(--spark-accent)] font-semibold"
                    : "border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
                title="Sort projects"
                aria-expanded={isSortOpen}
              >
                <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                <span>Sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
                <ChevronDown
                  className={`h-3 w-3 opacity-60 transition-transform duration-150 ${
                    isSortOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isSortOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] shadow-lg py-1 z-40 animate-in fade-in zoom-in-95 text-xs">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.key;

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.key);
                          setIsSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[var(--spark-accent)]/10 text-[var(--spark-accent)] font-semibold"
                            : "text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-[var(--spark-accent)] shrink-0 ml-1.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-12">
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-[var(--spark-accent)]" />}
              title={searchQuery ? "No matching projects" : "No projects created yet"}
              description={
                searchQuery
                  ? `No project matched "${searchQuery}". Try a different search term or filter.`
                  : "Organize your team initiatives with project portfolios, issue identifiers, and sprint tracking."
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

              const isPrivate = p.type === "PRIVATE";
              const isOverdue =
                p.targetDate &&
                new Date(p.targetDate) < new Date() &&
                p.status !== "COMPLETED";

              return (
                <div
                  key={p.id}
                  className={`group relative rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] hover:border-[var(--spark-accent)]/60 hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
                    activeMenuId === p.id ? "z-30" : "z-10"
                  }`}
                >
                  {/* Accent strip */}
                  <div
                    className="h-1.5 w-full rounded-t-[12px]"
                    style={{ backgroundColor: p.color || "#7C3AED" }}
                  />

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Top Row: Key badge, Category, Privacy, Status, Menu */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-[5px] text-[11px] font-mono font-bold uppercase tracking-wider text-white shadow-2xs"
                            style={{ backgroundColor: p.color || "#7C3AED" }}
                          >
                            {p.key}
                          </span>

                          {p.category && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)] truncate max-w-[110px]">
                              {p.category}
                            </span>
                          )}

                          {/* Privacy Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isPrivate
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                            }`}
                          >
                            {isPrivate ? (
                              <>
                                <Lock className="h-3 w-3 text-amber-500" />
                                <span>Private ({p.memberCount})</span>
                              </>
                            ) : (
                              <>
                                <Globe className="h-3 w-3 text-zinc-500" />
                                <span>Public</span>
                              </>
                            )}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : p.status === "ON_HOLD"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : p.status === "COMPLETED"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : p.status === "ARCHIVED"
                                ? "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                                : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-500"
                                  : p.status === "ON_HOLD"
                                  ? "bg-amber-500"
                                  : p.status === "COMPLETED"
                                  ? "bg-blue-500"
                                  : p.status === "ARCHIVED"
                                  ? "bg-zinc-500"
                                  : "bg-purple-500"
                              }`}
                            />
                            {p.status}
                          </span>
                        </div>

                        {/* Dropdown menu */}
                        <div className="relative" data-project-menu>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === p.id ? null : p.id))
                            }
                            className="p-1 rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === p.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-[10px] border border-[var(--spark-border)] bg-white dark:bg-[#1D182E] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs ring-1 ring-black/5 dark:ring-white/10">
                              <div className="px-3 py-1 text-[10px] font-bold text-[var(--spark-text-muted)] uppercase tracking-wider">
                                Lifecycle Status
                              </div>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(p.id, "ACTIVE")}
                                className="w-full text-left px-3 py-2 text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Active</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(p.id, "PLANNING")}
                                className="w-full text-left px-3 py-2 text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Clock className="h-3.5 w-3.5 text-purple-500" />
                                <span>Planning</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(p.id, "ON_HOLD")}
                                className="w-full text-left px-3 py-2 text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                                <span>On Hold</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(p.id, "COMPLETED")}
                                className="w-full text-left px-3 py-2 text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                                <span>Completed</span>
                              </button>

                              <div className="my-1 border-t border-[var(--spark-border-subtle)]" />

                              {p.status === "ARCHIVED" ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(p.id)}
                                  className="w-full text-left px-3 py-2 text-emerald-600 hover:bg-emerald-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Restore Project</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleArchive(p.id)}
                                  className="w-full text-left px-3 py-2 text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  <span>Archive Project</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors cursor-pointer font-medium"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete Project</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Project Title & Link to dedicated Project Hub */}
                      <Link href={`/projects/${p.key}`}>
                        <h3 className="text-base font-bold text-[var(--spark-text-primary)] hover:text-[var(--spark-accent)] transition-colors line-clamp-1 cursor-pointer">
                          {p.name}
                        </h3>
                      </Link>
                      <p className="mt-1 text-xs text-[var(--spark-text-secondary)] line-clamp-2 min-h-[2rem]">
                        {p.description || "No description provided for this initiative."}
                      </p>
                    </div>

                    {/* Meta info & Progress */}
                    <div className="space-y-3 pt-3 border-t border-[var(--spark-border-subtle)]">
                      {/* Owner & Target Date */}
                      <div className="flex items-center justify-between text-xs text-[var(--spark-text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            name={p.ownerName || "Lead"}
                            size="sm"
                            src={p.ownerAvatar || undefined}
                          />
                          <span className="truncate max-w-[110px] font-medium text-[var(--spark-text-primary)]">
                            {p.ownerName}
                          </span>
                        </div>

                        {targetDateFormatted ? (
                          <div
                            className={`flex items-center gap-1 text-[11px] ${
                              isOverdue
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-[var(--spark-text-muted)]"
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{targetDateFormatted}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--spark-text-muted)]">No target</span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[var(--spark-text-muted)] text-[11px]">
                            {p.taskStats.done} of {p.taskStats.total} work items completed
                          </span>
                          <span className="font-bold text-[var(--spark-text-primary)] text-[11px]">
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

                      {/* Breakdown Pills */}
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--spark-text-muted)] flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--spark-surface-subtle)] border border-[var(--spark-border-subtle)]">
                          {p.taskStats.todo} To Do
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {p.taskStats.inProgress} In Dev
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {p.taskStats.inReview} Review
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {p.taskStats.done} Done
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 py-3 bg-[var(--spark-surface-subtle)] border-t border-[var(--spark-border)] rounded-b-[12px] flex items-center justify-between">
                    <Link
                      href={`/projects/${p.key}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] transition-colors"
                    >
                      <span>Project Hub</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>

                    <Link
                      href={`/tasks?project=${p.id}`}
                      className="text-xs text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] font-medium"
                    >
                      Kanban Board
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
              className="relative w-full max-w-lg rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--spark-border)]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[var(--spark-accent)]/10 text-[var(--spark-accent)] flex items-center justify-center">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
                      Create Project
                    </h2>
                    <p className="text-xs text-[var(--spark-text-secondary)]">
                      Define a workspace initiative with key-prefixed tracking and privacy controls.
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
                {/* Project Name */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Carbon Ledger AI or Mobile Client"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                {/* Key & Category */}
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
                      placeholder="e.g. CLA"
                      className="w-full px-3 py-2 text-xs sm:text-sm font-mono uppercase font-bold rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                    />
                    <span className="text-[10px] text-[var(--spark-text-muted)]">
                      Prefix for issues (e.g. {key || "KEY"}-1)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                    >
                      {CATEGORY_PRESETS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                {/* Visibility: Public vs Private Project */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1.5">
                    Project Access & Visibility *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setProjectType("PUBLIC")}
                      className={`p-3 rounded-[10px] border text-left transition flex items-start gap-2.5 ${
                        projectType === "PUBLIC"
                          ? "border-[var(--spark-accent)] bg-[var(--spark-accent)]/5 shadow-2xs"
                          : "border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] hover:border-[var(--spark-border-hover)]"
                      }`}
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Globe className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                          <span>Public Project</span>
                          {projectType === "PUBLIC" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--spark-accent)]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--spark-text-muted)] mt-0.5 leading-snug">
                          All workspace members can view and collaborate on issues.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProjectType("PRIVATE")}
                      className={`p-3 rounded-[10px] border text-left transition flex items-start gap-2.5 ${
                        projectType === "PRIVATE"
                          ? "border-amber-500 bg-amber-500/5 shadow-2xs"
                          : "border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] hover:border-[var(--spark-border-hover)]"
                      }`}
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                          <span>Private Project</span>
                          {projectType === "PRIVATE" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--spark-text-muted)] mt-0.5 leading-snug">
                          Only designated members and admins can view issues.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* If Private Project: Member Selection */}
                {projectType === "PRIVATE" && (
                  <div className="p-3.5 rounded-[10px] border border-amber-500/30 bg-amber-500/5 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-[var(--spark-text-primary)]">
                          Assign Project Members
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {selectedMemberIds.length} employees selected
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--spark-text-secondary)]">
                      Select which employees from this organization will be granted access to this private project. You (the creator) are included by default.
                    </p>

                    {members.length > 3 && (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
                        <input
                          type="text"
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          placeholder="Filter members by name or email..."
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-primary)] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[var(--spark-border-subtle)]">
                      {filteredModalMembers.map((m) => {
                        const isSelected = selectedMemberIds.includes(m.userId);
                        const isCreator = m.userId === currentUser?.id;

                        return (
                          <div
                            key={m.userId}
                            onClick={() => toggleMemberSelection(m.userId)}
                            className={`pt-1.5 flex items-center justify-between p-2 rounded-[6px] cursor-pointer transition ${
                              isSelected
                                ? "bg-[var(--spark-surface)] text-[var(--spark-text-primary)] shadow-2xs"
                                : "hover:bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={m.user.fullName || "User"}
                                size="sm"
                                src={m.user.avatarUrl || undefined}
                              />
                              <div>
                                <div className="text-xs font-semibold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                                  <span>{m.user.fullName}</span>
                                  {isCreator && (
                                    <span className="text-[10px] font-mono text-[var(--spark-accent)] font-semibold">
                                      (Lead)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--spark-text-muted)]">
                                  {m.user.email} • {m.role}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`h-5 w-5 rounded-[4px] border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-[var(--spark-accent)] border-[var(--spark-accent)] text-white"
                                  : "border-[var(--spark-border-strong)] bg-[var(--spark-surface)]"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Project mission, scope, and key deliverables..."
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface-elevated)] text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)] resize-none"
                  />
                </div>

                {/* Accent Color Selection */}
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
                          selectedColor === c.hex
                            ? "scale-115 ring-2 ring-offset-2 ring-[var(--spark-accent)]"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 border-t border-[var(--spark-border)] flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting || !name.trim()}
                  >
                    {isSubmitting ? "Creating..." : "Create Project"}
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
