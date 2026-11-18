"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users, MessageSquare, Mail, FolderKanban, BarChart3, LineChart } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceDashboardData,
  WorkspaceDashboardData,
} from "@/lib/actions/dashboard";
import { clientDashboardCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";

export default function InsightsPage() {
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<WorkspaceDashboardData | null>(() => {
    if (activeWorkspace?.id && clientDashboardCache.has(activeWorkspace.id)) {
      return clientDashboardCache.get(activeWorkspace.id)!;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !activeWorkspace?.id || !clientDashboardCache.has(activeWorkspace.id);
  });

  const loadData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }

    const cached = clientDashboardCache.get(activeWorkspace.id);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      if (clientDashboardCache.isFresh(activeWorkspace.id)) {
        return;
      }
    } else {
      setIsLoading(true);
    }

    try {
      const res = await getWorkspaceDashboardData(activeWorkspace.id);
      if (res.success && res.data) {
        clientDashboardCache.set(activeWorkspace.id, res.data);
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load insights data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribeBootstrap((payload) => {
      if (payload.dashboard && payload.activeWorkspace?.id === activeWorkspace?.id) {
        setData(payload.dashboard);
        setIsLoading(false);
      }
    });
  }, [activeWorkspace?.id]);

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          description={`Activity and collaboration overview for ${activeWorkspace?.name || "your workspace"}.`}
        />

        {/* Flat 2.0 Telemetry Bento Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-[var(--spark-border-strong)] hover:shadow-card">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-[var(--spark-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Members
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                {isLoading ? "—" : data?.counts.members ?? 0}
              </div>
              <p className="text-[11px] text-[var(--spark-text-muted)]">
                Active accounts
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[var(--spark-border-strong)] hover:shadow-card">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-[var(--spark-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Channels
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#10B981]/12 text-[#10B981]">
                  <MessageSquare className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                {isLoading ? "—" : data?.counts.channels ?? 0}
              </div>
              <p className="text-[11px] text-[#10B981] font-medium">
                Active team channels
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[var(--spark-border-strong)] hover:shadow-card">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-[var(--spark-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Direct Messages
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                  <Mail className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                {isLoading ? "—" : data?.counts.directConversations ?? 0}
              </div>
              <p className="text-[11px] text-[var(--spark-text-muted)]">
                1-on-1 conversations
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[var(--spark-border-strong)] hover:shadow-card">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-[var(--spark-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Pending Invites
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F59E0B]/12 text-[#F59E0B]">
                  <FolderKanban className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-[var(--spark-text-primary)] tabular-nums">
                {isLoading ? "—" : data?.counts.pendingInvitations ?? 0}
              </div>
              <p className="text-[11px] text-[var(--spark-text-muted)]">
                Awaiting response
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Asymmetrical Bento Analytical Row (7 + 5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-7">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Tasks by Status</CardTitle>
              <CardDescription>Distribution across workspace workflows</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No task data yet"
                description="Metrics will appear here once tasks are created and updated."
                className="min-h-[220px]"
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Sprint Velocity</CardTitle>
              <CardDescription>Completion trends across milestones</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <EmptyState
                icon={<LineChart className="h-5 w-5" />}
                title="No velocity data yet"
                description="Trends will populate here as projects and milestones progress."
                className="min-h-[220px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellLayout>
  );
}
