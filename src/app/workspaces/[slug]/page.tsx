"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  User,
  Users,
  Settings,
  Mail,
  CheckCircle2,
  AlertCircle,
  KanbanSquare,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";
import { getWorkspaceBySlug } from "@/lib/actions/workspaces";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();

  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setIsLoading(true);
      setError(null);
      const res = await getWorkspaceBySlug(slug);
      if (!res.success || !res.workspace) {
        setError(res.error || "Workspace not found.");
      } else {
        setWorkspaceData(res.workspace);
        setCallerRole(res.callerRole);
      }
      setIsLoading(false);
    }
    load();
  }, [slug]);

  if (isLoading) {
    return (
      <ShellLayout>
        <div className="max-w-4xl mx-auto py-12 px-6 text-center text-[var(--spark-text-secondary)] text-xs">
          Loading workspace details...
        </div>
      </ShellLayout>
    );
  }

  if (error || !workspaceData) {
    return (
      <ShellLayout>
        <div className="max-w-md mx-auto py-16 px-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
            Workspace Access Denied
          </h2>
          <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed">
            {error || "You do not have access to this workspace or it does not exist."}
          </p>
          <div className="pt-2">
            <Link href="/workspaces">
              <Button variant="outline" size="sm">
                Return to Workspaces
              </Button>
            </Link>
          </div>
        </div>
      </ShellLayout>
    );
  }

  const isCurrentActive = activeWorkspace.id === workspaceData.id;
  const isPersonal = workspaceData.type === "PERSONAL" || workspaceData.type === "personal";
  const canAdmin = callerRole === "OWNER" || callerRole === "ADMIN";

  return (
    <ShellLayout>
      <div className="max-w-4xl mx-auto py-4 space-y-8">
        {/* Workspace Hero */}
        <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-[var(--spark-highlight)] border border-[var(--spark-accent)]/25 text-[var(--spark-accent)] font-bold text-xl">
              {isPersonal ? (
                <User className="h-7 w-7" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[var(--spark-text-primary)]">
                  {workspaceData.name}
                </h1>
                <Badge variant={isPersonal ? "default" : "violet"} size="sm">
                  {isPersonal ? "Personal" : "Organization"}
                </Badge>
                <Badge variant="outline" size="sm">
                  {callerRole}
                </Badge>
              </div>
              <p className="text-xs text-[var(--spark-text-muted)] font-mono mt-0.5">
                slug: {workspaceData.slug}
              </p>
              {workspaceData.description && (
                <p className="text-xs text-[var(--spark-text-secondary)] mt-2 max-w-xl leading-relaxed">
                  {workspaceData.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCurrentActive ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActiveWorkspace({
                    id: workspaceData.id,
                    name: workspaceData.name,
                    slug: workspaceData.slug,
                    type: isPersonal ? "personal" : "organization",
                    role: callerRole as any,
                  });
                }}
              >
                Set as Active
              </Button>
            ) : (
              <Badge variant="success" size="md">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Active Workspace
              </Badge>
            )}

            {canAdmin && (
              <Link href={`/workspaces/${workspaceData.slug}/settings`}>
                <Button variant="outline" leftIcon={<Settings className="h-3.5 w-3.5" />}>
                  Settings
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            href={`/workspaces/${workspaceData.slug}/members`}
            className="group rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-5 hover:border-[var(--spark-accent)] transition-all duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                <Users className="h-4 w-4" />
              </div>
              <Badge variant="default" size="sm">
                {workspaceData.memberCount} Members
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-[var(--spark-text-primary)] mt-3 group-hover:text-[var(--spark-accent)] transition-colors duration-150">
              Team Directory
            </h3>
            <p className="text-xs text-[var(--spark-text-secondary)] mt-1">
              View, manage, and assign roles for all team members.
            </p>
          </Link>

          {!isPersonal && canAdmin && (
            <Link
              href={`/workspaces/${workspaceData.slug}/invitations`}
              className="group rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-5 hover:border-[var(--spark-accent)] transition-all duration-150"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#10B981]/12 text-[#10B981]">
                <Mail className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--spark-text-primary)] mt-3 group-hover:text-[var(--spark-accent)] transition-colors duration-150">
                Pending Invitations
              </h3>
              <p className="text-xs text-[var(--spark-text-secondary)] mt-1">
                Dispatch and manage invitations to join your workspace.
              </p>
            </Link>
          )}

          <Link
            href="/tasks"
            className="group rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-5 hover:border-[var(--spark-accent)] transition-all duration-150"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
              <KanbanSquare className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--spark-text-primary)] mt-3 group-hover:text-[var(--spark-accent)] transition-colors duration-150">
              Workspace Tasks
            </h3>
            <p className="text-xs text-[var(--spark-text-secondary)] mt-1">
              Track issues, sprints, and task workflows for this tenant.
            </p>
          </Link>
        </div>
      </div>
    </ShellLayout>
  );
}
