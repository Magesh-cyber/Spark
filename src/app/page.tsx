"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckSquare,
  FolderKanban,
  Video,
  ChevronRight,
  Plus,
  Users,
  MessageSquare,
  Mail,
  Sliders,
  Calendar as CalendarIcon,
  Shield,
  ExternalLink,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/lib/workspace-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getWorkspaceDashboardData,
  WorkspaceDashboardData,
} from "@/lib/actions/dashboard";
import { clientDashboardCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";

export default function WorkspaceHomePage() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sampleSwitch, setSampleSwitch] = useState(true);
  const [sampleCheckbox, setSampleCheckbox] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);

  // Real database-driven dashboard state
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

    // Hydrate immediately from cache if available (0ms render)
    const cached = clientDashboardCache.get(activeWorkspace.id);
    if (cached) {
      setDashboardData(cached);
      setIsLoadingDashboard(false);
      // Skip redundant server round-trip when bootstrap just delivered fresh data
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
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={
            isPersonal
              ? `Welcome back, ${currentUser.name.split(" ")[0] || "User"}`
              : activeWorkspace.name || "Workspace Overview"
          }
          description={
            isPersonal
              ? "Here is your personal overview of active channels, team members, and workspace data."
              : "Organization workspace overview, verified members, communication channels, and real-time operations."
          }
          badge={
            <Badge variant={isPersonal ? "default" : "info"} size="md">
              {isPersonal ? "Personal Workspace" : "Organization"}
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Link href="/teams" prefetch={true}>
                <Button variant="outline" size="sm" leftIcon={<Users className="h-3.5 w-3.5" />}>
                  Team Directory
                </Button>
              </Link>
              <Link href="/chat" prefetch={true}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                >
                  Open Chat
                </Button>
              </Link>
            </div>
          }
        />

        {/* View Switcher: Dashboard vs Design System Architect Gallery */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard">
              {isPersonal ? "Personal Dashboard" : "Workspace Overview"}
            </TabsTrigger>
            <TabsTrigger value="design-system">
              Design System & Component Specs
            </TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB CONTENT */}
          <TabsContent value="dashboard" className="space-y-6 mt-0">
            {/* Real Database Metric Cards */}
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
                    {isLoadingDashboard ? "—" : dashboardData?.counts.members ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Verified in database
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Chat Channels
                    </span>
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-slate-900">
                    {isLoadingDashboard ? "—" : dashboardData?.counts.channels ?? 0}
                  </div>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    Real-time Nexconn linked
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
                    {isLoadingDashboard ? "—" : dashboardData?.counts.directConversations ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    1-on-1 team dialogues
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Pending Invites
                    </span>
                    <FolderKanban className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-slate-900">
                    {isLoadingDashboard ? "—" : dashboardData?.counts.pendingInvitations ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Awaiting member response
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Split Content Section: Real Workspace Channels & Real Team Members */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Real Workspace Channels */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Workspace Communication Channels</CardTitle>
                      <CardDescription>
                        Real-time channels provisioned for {activeWorkspace.name}
                      </CardDescription>
                    </div>
                    <Link
                      href="/chat"
                      prefetch={true}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>Open chat</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoadingDashboard ? (
                      <LoadingState type="table" count={3} />
                    ) : !dashboardData?.recentChannels || dashboardData.recentChannels.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No channels provisioned for this workspace yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {dashboardData.recentChannels.map((channel) => (
                          <div
                            key={channel.id}
                            className="py-3 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">
                                #
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-900 leading-tight">
                                  #{channel.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {channel.description || "General channel for team collaboration"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={channel.type === "PUBLIC" ? "default" : "warning"} size="sm">
                                {channel.type}
                              </Badge>
                              <Link
                                href="/chat"
                                prefetch={true}
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                Join
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Truthful Empty State for Tasks (Module 04) */}
                <Card>
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Assigned Tasks</CardTitle>
                      <CardDescription>Workspace deliverable tracking</CardDescription>
                    </div>
                    <Link
                      href="/tasks"
                      prefetch={true}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>Task board</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </CardHeader>
                  <CardContent className="p-6">
                    <EmptyState
                      icon={<CheckSquare className="h-5 w-5" />}
                      title="No tasks in this workspace"
                      description="Task management database persistence will connect in Module 04. No fabricated tasks are displayed."
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Verified Members & Initiatives */}
              <div className="space-y-6">
                {/* Real Verified Members Snapshot */}
                <Card>
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Active Members</CardTitle>
                      <CardDescription>Verified workspace accounts</CardDescription>
                    </div>
                    <Users className="h-4 w-4 text-slate-400" />
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {isLoadingDashboard ? (
                      <LoadingState type="cards" count={3} />
                    ) : !dashboardData?.recentMembers || dashboardData.recentMembers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        No team members yet.
                      </div>
                    ) : (
                      dashboardData.recentMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={m.fullName}
                              src={m.avatarUrl || undefined}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-slate-900 leading-tight">
                                {m.fullName}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {m.email}
                              </p>
                            </div>
                          </div>
                          <Badge variant="default" size="sm">
                            {m.role}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Truthful Empty State for Active Projects */}
                <Card>
                  <CardHeader className="p-4 border-b border-slate-100">
                    <CardTitle className="text-sm">Active Initiatives</CardTitle>
                    <CardDescription>Milestones & deliverables</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <EmptyState
                      icon={<FolderKanban className="h-5 w-5" />}
                      title="No active projects"
                      description="Initiatives and roadmap milestones will populate here once projects are initialized."
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* DESIGN SYSTEM & COMPONENT ARCHITECTURE GALLERY (Preserved from spec) */}
          <TabsContent value="design-system" className="space-y-8 mt-0">
            {/* Design Tokens & Colors */}
            <Card>
              <CardHeader>
                <CardTitle>Design Tokens & Color Palette</CardTitle>
                <CardDescription>
                  Strictly implemented according to Section 3 of the Master UI/UX Specification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Primary & Secondary Colors
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#2563EB] mb-2" />
                      <p className="font-semibold text-slate-900">Primary Blue</p>
                      <p className="text-[11px] text-slate-500 font-mono">#2563EB</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#1D4ED8] mb-2" />
                      <p className="font-semibold text-slate-900">Primary Hover</p>
                      <p className="text-[11px] text-slate-500 font-mono">#1D4ED8</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#EFF6FF] border border-blue-200 mb-2" />
                      <p className="font-semibold text-slate-900">Primary Subtle</p>
                      <p className="text-[11px] text-slate-500 font-mono">#EFF6FF</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#7C3AED] mb-2" />
                      <p className="font-semibold text-slate-900">Accent Violet</p>
                      <p className="text-[11px] text-slate-500 font-mono">#7C3AED</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Surfaces & Typography
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#F8FAFC] border border-slate-200 mb-2" />
                      <p className="font-semibold text-slate-900">App Background</p>
                      <p className="text-[11px] text-slate-500 font-mono">#F8FAFC</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#FFFFFF] border border-slate-200 mb-2" />
                      <p className="font-semibold text-slate-900">Main Surface</p>
                      <p className="text-[11px] text-slate-500 font-mono">#FFFFFF</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#0F172A] mb-2" />
                      <p className="font-semibold text-slate-900">Primary Text</p>
                      <p className="text-[11px] text-slate-500 font-mono">#0F172A</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="h-8 rounded bg-[#475569] mb-2" />
                      <p className="font-semibold text-slate-900">Secondary Text</p>
                      <p className="text-[11px] text-slate-500 font-mono">#475569</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Buttons & States */}
            <Card>
              <CardHeader>
                <CardTitle>Button System (Section 4)</CardTitle>
                <CardDescription>
                  Variants, geometry (8px radius), loading, and disabled states.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary Action</Button>
                  <Button variant="secondary">Secondary Action</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button
                    variant="primary"
                    isLoading={buttonLoading}
                    onClick={() => {
                      setButtonLoading(true);
                      setTimeout(() => setButtonLoading(false), 1500);
                    }}
                  >
                    Click for Loading State
                  </Button>
                  <Button variant="primary" disabled>
                    Disabled State
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="sm" variant="primary">Small (h-8)</Button>
                  <Button size="md" variant="primary">Medium (h-9)</Button>
                  <Button size="lg" variant="primary">Large (h-10)</Button>
                  <Button size="icon" variant="outline">
                    <Sliders className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Badges & Status Indicators */}
            <Card>
              <CardHeader>
                <CardTitle>Badges & Status Elements (Section 3)</CardTitle>
                <CardDescription>
                  Semantic badges for task priority, meeting status, and workspace tags.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default Neutral</Badge>
                  <Badge variant="info" dot>Information</Badge>
                  <Badge variant="success" dot>Success / Completed</Badge>
                  <Badge variant="warning" dot>Warning / At Risk</Badge>
                  <Badge variant="error" dot>Error / Delayed</Badge>
                  <Badge variant="violet" dot>AI Intelligence</Badge>
                  <Badge variant="outline">Outline Variant</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Form Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Form Controls & Inputs (Section 4)</CardTitle>
                <CardDescription>
                  Consistent control heights, validation, checkboxes, and switches.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Project Title"
                    placeholder="Enter project name..."
                    hint="Must be between 3 and 50 characters."
                  />
                  <Input
                    label="Repository Slug"
                    placeholder="e.g. spark-core"
                    error="This slug is already reserved by another repository."
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-6">
                  <Switch
                    checked={sampleSwitch}
                    onCheckedChange={setSampleSwitch}
                    label="Auto-generate AI meeting summaries"
                    description="Requires explicit user confirmation before writing changes."
                  />
                  <Checkbox
                    checked={sampleCheckbox}
                    onCheckedChange={setSampleCheckbox}
                    label="Notify team members on task status changes"
                    hint="Sends push and email alerts."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Global Confirmation Dialog Test */}
        <ConfirmDialog
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          title="Confirm Workspace Action"
          description="Are you sure you want to trigger this action? All changes will be saved to your active workspace."
          confirmLabel="Proceed"
          onConfirm={() => {
            setShowConfirmModal(false);
          }}
        />
      </div>
    </ShellLayout>
  );
}
