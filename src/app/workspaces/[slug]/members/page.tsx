"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  UserPlus,
  Mail,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getWorkspaceBySlug } from "@/lib/actions/workspaces";
import {
  getWorkspaceMembers,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
} from "@/lib/actions/workspace-members";
import { inviteWorkspaceMember } from "@/lib/actions/workspace-invitations";
import { WorkspaceMemberItem, WorkspaceRole } from "@/lib/types";
import { canManageMembers, canChangeMemberRoles, canInviteMembers } from "@/lib/permissions";

export default function WorkspaceMembersPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [workspace, setWorkspace] = useState<any>(null);
  const [callerRole, setCallerRole] = useState<WorkspaceRole>("MEMBER");
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MANAGER" | "MEMBER" | "GUEST">("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    text: string;
    devLink?: string;
  } | null>(null);

  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    const res = await getWorkspaceBySlug(slug);
    if (res.success && res.workspace) {
      setWorkspace(res.workspace);
      setCallerRole(res.callerRole as WorkspaceRole);

      const memRes = await getWorkspaceMembers(res.workspace.id);
      if (memRes.members) {
        setMembers(memRes.members);
      }
    }
    setIsLoading(false);
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    setActionError("");
    const res = await updateMemberRole(workspace.id, memberId, newRole);
    if (res.success) {
      await loadData();
    } else {
      setActionError(res.error || "Failed to update role.");
    }
  };

  const handleStatusChange = async (memberId: string, newStatus: "ACTIVE" | "SUSPENDED") => {
    setActionError("");
    const res = await updateMemberStatus(workspace.id, memberId, newStatus);
    if (res.success) {
      await loadData();
    } else {
      setActionError(res.error || "Failed to update status.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) {
      return;
    }
    setActionError("");
    const res = await removeMember(workspace.id, memberId);
    if (res.success) {
      await loadData();
    } else {
      setActionError(res.error || "Failed to remove member.");
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteFeedback(null);

    const res = await inviteWorkspaceMember(workspace.id, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    if (res.success) {
      setInviteFeedback({
        type: "success",
        text: `Invitation dispatched to ${inviteEmail}.`,
        devLink: res.devLink,
      });
      setInviteEmail("");
    } else {
      setInviteFeedback({
        type: "error",
        text: res.error || "Failed to send invitation.",
      });
    }
    setIsInviting(false);
  };

  if (isLoading) {
    return (
      <ShellLayout>
        <div className="max-w-4xl mx-auto py-12 px-6 text-center text-[var(--spark-text-secondary)] text-xs">
          Loading member directory...
        </div>
      </ShellLayout>
    );
  }

  if (!workspace) {
    return (
      <ShellLayout>
        <div className="max-w-md mx-auto py-16 px-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
            Workspace Not Found
          </h2>
          <Link href="/workspaces">
            <Button variant="outline" size="sm">
              Return to Workspaces
            </Button>
          </Link>
        </div>
      </ShellLayout>
    );
  }

  const isPersonal = workspace.type === "PERSONAL" || workspace.type === "personal";
  const canInvite = !isPersonal && canInviteMembers(callerRole, workspace.settings);

  return (
    <ShellLayout>
      <div className="max-w-4xl mx-auto py-4 space-y-6">
        <div>
          <Link
            href={`/workspaces/${workspace.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] transition-colors duration-150 mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {workspace.name}</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--spark-border)] pb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--spark-text-primary)]">
                Team Directory
              </h1>
              <p className="text-sm text-[var(--spark-text-secondary)] mt-1">
                {members.length} member{members.length === 1 ? "" : "s"} in {workspace.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isPersonal && (
                <Link href={`/workspaces/${workspace.slug}/invitations`}>
                  <Button variant="outline" size="sm" leftIcon={<Mail className="h-3.5 w-3.5" />}>
                    Pending Invitations
                  </Button>
                </Link>
              )}
              {canInvite && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                  leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                >
                  Invite Member
                </Button>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Member Table */}
        <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden">
          <div className="divide-y divide-[var(--spark-border)]">
            {members.map((mem) => {
              const canEditRole = canChangeMemberRoles(callerRole, mem.role, "MEMBER");
              const canManage = canManageMembers(callerRole, mem.role);
              const isSuspended = mem.status === "SUSPENDED";

              return (
                <div
                  key={mem.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-[var(--spark-surface-subtle)]/50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={mem.user.fullName}
                      src={mem.user.avatarUrl || undefined}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--spark-text-primary)]">
                          {mem.user.fullName}
                        </span>
                        {isSuspended && (
                          <Badge variant="error" size="sm">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--spark-text-secondary)] font-normal">
                        {mem.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {canEditRole ? (
                      <select
                        value={mem.role}
                        onChange={(e) => handleRoleChange(mem.id, e.target.value as WorkspaceRole)}
                        className="rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-2.5 py-1 text-xs font-medium text-[var(--spark-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="MEMBER">Member</option>
                        <option value="GUEST">Guest</option>
                      </select>
                    ) : (
                      <Badge
                        variant={mem.role === "OWNER" ? "violet" : "default"}
                        size="sm"
                      >
                        {mem.role}
                      </Badge>
                    )}

                    {canManage && (
                      <div className="flex items-center gap-1">
                        {isSuspended ? (
                          <button
                            type="button"
                            title="Reactivate Member"
                            onClick={() => handleStatusChange(mem.id, "ACTIVE")}
                            className="p-1.5 rounded-[6px] text-[#10B981] hover:bg-[#10B981]/12 transition-colors duration-150"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Suspend Member"
                            onClick={() => handleStatusChange(mem.id, "SUSPENDED")}
                            className="p-1.5 rounded-[6px] text-[#F59E0B] hover:bg-[#F59E0B]/12 transition-colors duration-150"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          title="Remove Member"
                          onClick={() => handleRemoveMember(mem.id)}
                          className="p-1.5 rounded-[6px] text-rose-500 hover:bg-rose-500/12 transition-colors duration-150"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invite Member Modal (Glassmorphic Overlay) */}
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0B14]/55 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border spark-glass p-6 text-[var(--spark-text-primary)] shadow-modal animate-in fade-in-50 zoom-in-95 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--spark-border)] pb-3">
                <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                  Invite Team Member
                </h3>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="text-xs text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                >
                  ✕
                </button>
              </div>

              {inviteFeedback && (
                <div
                  className={`rounded-[8px] border p-3 text-xs space-y-1.5 ${
                    inviteFeedback.type === "success"
                      ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {inviteFeedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    )}
                    <span>{inviteFeedback.text}</span>
                  </div>
                  {inviteFeedback.devLink && (
                    <div className="pt-1 text-[11px] font-mono break-all border-t border-[#10B981]/25 mt-1">
                      <p className="font-semibold text-[var(--spark-text-primary)]">
                        Dev Acceptance Link:
                      </p>
                      <a
                        href={inviteFeedback.devLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--spark-accent)] underline"
                      >
                        {inviteFeedback.devLink}
                      </a>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <Input
                  label="Work Email Address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@citchennai.net"
                  required
                />

                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
                    Assign Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "ADMIN" | "MANAGER" | "MEMBER" | "GUEST")
                    }
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-3 py-2 text-xs text-[var(--spark-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]"
                  >
                    <option value="MEMBER">Member (Standard collaborator)</option>
                    <option value="MANAGER">Manager (Can invite &amp; organize team)</option>
                    <option value="ADMIN">Admin (Full workspace administration)</option>
                    <option value="GUEST">Guest (Restricted shared access)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--spark-border)]">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button variant="primary" type="submit" isLoading={isInviting}>
                    Dispatch Invitation
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
