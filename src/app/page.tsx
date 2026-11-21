"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckSquare,
  FolderKanban,
  ChevronRight,
  Users,
  MessageSquare,
  Mail,
  Building2,
  User,
  ArrowUpRight,
  Plus,
  UserPlus,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import {
  getWorkspaceDashboardData,
  WorkspaceDashboardData,
} from "@/lib/actions/dashboard";
import { clientDashboardCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";

export default function WorkspaceHomePage() {
  const { activeWorkspace, currentUser } = useWorkspace();

  const [dashboardData, setDashboardData] = useState<WorkspaceDashboardData | null>(() => {
    if (activeWorkspace?.id && clientDashboardCache.has(activeWorkspace.id)) {
      return clientDashboardCache.get(activeWorkspace.id)!;
    }
    return null;
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(() => {
    return !activeWorkspace?.id || !clientDashboardCache.has(activeWorkspace.id);
  });

  const isPersonal =
    activeWorkspace.type === "personal" || activeWorkspace.type === "PERSONAL";

  const loadDashboard = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoadingDashboard(false);
      return;
    }

    const cached = clientDashboardCache.get(activeWorkspace.id);
    if (cached) {
      setDashboardData(cached);
      setIsLoadingDashboard(false);
      if (clientDashboardCache.isFresh(activeWorkspace.id)) {
        return;
      }
    } else {
      setIsLoadingDashboard(true);
    }

    try {
      const res = await getWorkspaceDashboardData(activeWorkspace.id);
      if (res.success && res.data) {
        clientDashboardCache.set(activeWorkspace.id, res.data);
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error("Failed to load workspace dashboard data:", err);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    return subscribeBootstrap((payload) => {
      if (payload.dashboard && payload.activeWorkspace?.id === activeWorkspace?.id) {
        setDashboardData(payload.dashboard);
        setIsLoadingDashboard(false);
      }
    });
  }, [activeWorkspace?.id]);

  return (
    <ShellLayout>
      <div className="space-y-5">
        {/* Top Asymmetrical Bento Row (5 + 7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Hero Workspace Summary Tile (Claymorphic Medallion + Minimalist Typography + Crisp CTA) */}
          <Card className="lg:col-span-5 flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] spark-clay-icon text-[var(--spark-accent)]">
                  {isPersonal ? (
                    <User className="h-5 w-5" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--spark-highlight)] px-2 py-0.5 text-[11px] font-semibold text-[var(--spark-highlight-text)] spark-brutal-badge">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {isPersonal ? "Personal" : "Organization"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--spark-text-primary)]">
                  {isPersonal
                    ? `Welcome back, ${currentUser.name.split(" ")[0] || "User"}`
                    : activeWorkspace.name || "Workspace Overview"}
                </h1>
                <p className="text-xs sm:text-[13px] text-[var(--spark-text-secondary)] leading-relaxed">
                  {isPersonal
                    ? "Manage your messages, tasks, and projects from one focused workspace."
                    : "Stay connected across team channels, direct conversations, and active projects."}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--spark-border)] flex flex-wrap items-center gap-2.5">
              <Link href="/chat" prefetch={true}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                >
                  Open Chat
                </Button>
              </Link>
              <Link href="/teams" prefetch={true}>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Users className="h-3.5 w-3.5" />}
                >
                  Team Directory
                </Button>
              </Link>
            </div>
          </Card>

          {/* Right 7 Cols: 2x2 Flat 2.0 Bento Metric Tiles */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-4">
            <Card className="p-5 flex flex-col justify-between hover:border-[var(--spark-border-strong)] hover:shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-secondary)]">
                  Members
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                  {isLoadingDashboard ? "—" : dashboardData?.counts.members ?? 0}
                </div>
                <p className="text-[11px] text-[var(--spark-text-muted)] mt-1">
                  Active in workspace
                </p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between hover:border-[var(--spark-border-strong)] hover:shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-secondary)]">
                  Channels
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#10B981]/12 text-[#10B981]">
                  <MessageSquare className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                  {isLoadingDashboard ? "—" : dashboardData?.counts.channels ?? 0}
                </div>
                <p className="text-[11px] text-[#10B981] font-medium mt-1">
                  Live &amp; connected
                </p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between hover:border-[var(--spark-border-strong)] hover:shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-secondary)]">
                  Direct Messages
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                  <Mail className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                  {isLoadingDashboard ? "—" : dashboardData?.counts.directConversations ?? 0}
                </div>
                <p className="text-[11px] text-[var(--spark-text-muted)] mt-1">
                  1-on-1 conversations
                </p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between hover:border-[var(--spark-border-strong)] hover:shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-secondary)]">
                  Pending Invites
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F59E0B]/12 text-[#F59E0B]">
                  <FolderKanban className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                  {isLoadingDashboard ? "—" : dashboardData?.counts.pendingInvitations ?? 0}
                </div>
                <p className="text-[11px] text-[var(--spark-text-muted)] mt-1">
                  Awaiting response
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Bento Row 1: Communication & Team (Synchronized Grid Row) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left 7 Cols: Active Channels */}
          <Card className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">Channels</CardTitle>
                  <CardDescription>
                    Team channels in {activeWorkspace.name}
                  </CardDescription>
                </div>
                <Link
                  href="/chat"
                  prefetch={true}
                  className="text-xs font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] inline-flex items-center gap-1 transition-colors duration-150"
                >
                  <span>Open chat</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {isLoadingDashboard ? (
                  <LoadingState type="table" count={3} />
                ) : !dashboardData?.recentChannels ||
                  dashboardData.recentChannels.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--spark-text-secondary)]">
                    No channels created yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--spark-border)]">
                    {dashboardData.recentChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className="py-2.5 flex items-center justify-between hover:bg-[var(--spark-surface-subtle)]/60 px-2 rounded-[8px] transition-colors duration-150"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 shrink-0 rounded-[7px] bg-[var(--spark-highlight)] text-[var(--spark-accent)] flex items-center justify-center text-xs font-bold">
                            #
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--spark-text-primary)] leading-tight truncate">
                              #{channel.name}
                            </p>
                            <p className="text-[11px] text-[var(--spark-text-secondary)] truncate mt-0.5">
                              {channel.description || "General team discussions"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge
                            variant={channel.type === "PUBLIC" ? "secondary" : "warning"}
                            size="sm"
                          >
                            {channel.type}
                          </Badge>
                          <Link
                            href="/chat"
                            prefetch={true}
                            className="text-xs font-medium text-[var(--spark-accent)] hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </div>

            <div className="p-4 pt-3 border-t border-[var(--spark-border)] flex items-center justify-between text-xs text-[var(--spark-text-secondary)]">
              <span>Need a new discussion space?</span>
              <Link
                href="/chat"
                prefetch={true}
                className="inline-flex items-center gap-1 font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] transition-colors duration-150"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New channel</span>
              </Link>
            </div>
          </Card>

          {/* Right 5 Cols: Team Members */}
          <Card className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">Team Members</CardTitle>
                  <CardDescription>People in {activeWorkspace.name}</CardDescription>
                </div>
                <Link
                  href="/teams"
                  prefetch={true}
                  className="text-xs font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] inline-flex items-center gap-1 transition-colors duration-150"
                >
                  <span>All</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {isLoadingDashboard ? (
                  <LoadingState type="cards" count={3} />
                ) : !dashboardData?.recentMembers ||
                  dashboardData.recentMembers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--spark-text-secondary)]">
                    No team members yet.
                  </div>
                ) : (
                  dashboardData.recentMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)]/55 p-2 hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={m.fullName}
                          src={m.avatarUrl || undefined}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--spark-text-primary)] leading-tight">
                            {m.fullName}
                          </p>
                          <p className="truncate text-[10px] text-[var(--spark-text-secondary)] mt-0.5">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <Badge variant="violet" size="sm">
                        {m.role}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </div>

            <div className="p-4 pt-3 border-t border-[var(--spark-border)] flex items-center justify-between text-xs text-[var(--spark-text-secondary)]">
              <span>Manage workspace access</span>
              <Link
                href="/teams"
                prefetch={true}
                className="inline-flex items-center gap-1 font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] transition-colors duration-150"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite member</span>
              </Link>
            </div>
          </Card>
        </div>

        {/* Bottom Bento Row 2: Tasks & Projects (Symmetrically Aligned Grid Row) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left 7 Cols: Assigned Tasks */}
          <Card className="lg:col-span-7 flex flex-col justify-between">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Assigned Tasks</CardTitle>
                <CardDescription>Your upcoming work items</CardDescription>
              </div>
              <Link
                href="/tasks"
                prefetch={true}
                className="text-xs font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] inline-flex items-center gap-1 transition-colors duration-150"
              >
                <span>Task board</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<CheckSquare className="h-5 w-5" />}
                title="No assigned tasks"
                description="Tasks assigned to you in this workspace will appear here."
                className="min-h-[170px]"
              />
            </CardContent>
          </Card>

          {/* Right 5 Cols: Active Projects */}
          <Card className="lg:col-span-5 flex flex-col justify-between">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Projects</CardTitle>
                <CardDescription>Active initiatives &amp; milestones</CardDescription>
              </div>
              <Link
                href="/projects"
                prefetch={true}
                className="text-xs font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] inline-flex items-center gap-1 transition-colors duration-150"
              >
                <span>View all</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<FolderKanban className="h-5 w-5" />}
                title="No active projects"
                description="Projects and milestones created in this workspace will appear here."
                className="min-h-[170px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellLayout>
  );
}
