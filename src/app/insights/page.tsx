"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Mail, FolderKanban, BarChart3, LineChart } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceDashboardData,
  WorkspaceDashboardData,
} from "@/lib/actions/dashboard";

export default function InsightsPage() {
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<WorkspaceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceDashboardData(activeWorkspace.id);
      if (res.success && res.data) {
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

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Insights & Operational Health"
          description={`Aggregated workspace telemetry and collaboration activity for ${activeWorkspace?.name || "your workspace"}.`}
          badge={
            <Badge variant="default" size="sm">
              Live Telemetry
            </Badge>
          }
        />

        {/* Real Database Telemetry Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Active Members
                </span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? "—" : data?.counts.members ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Verified workspace accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Real-Time Channels
                </span>
                <MessageSquare className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? "—" : data?.counts.channels ?? 0}
              </div>
              <p className="text-[11px] text-emerald-600 font-medium">
                Nexconn group channels
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Direct Conversations
                </span>
                <Mail className="h-4 w-4 text-violet-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? "—" : data?.counts.directConversations ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Peer-to-peer discussions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Pending Invitations
                </span>
                <FolderKanban className="h-4 w-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? "—" : data?.counts.pendingInvitations ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Active invites in database
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytical Sections — Truthful Unpopulated States */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm">Deliverables by Status</CardTitle>
              <CardDescription>Task backlog distribution across active teams</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No task metrics available"
                description="Task status analytics and completion percentages will populate automatically once tasks are provisioned and worked on."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm">Sprint Velocity & Milestone Health</CardTitle>
              <CardDescription>Tracked against target milestone deliverables</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <EmptyState
                icon={<LineChart className="h-5 w-5" />}
                title="No velocity data recorded"
                description="Sprint cycle time, completion ratios, and milestone tracking will activate as projects and sprints are conducted in this workspace."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellLayout>
  );
}
