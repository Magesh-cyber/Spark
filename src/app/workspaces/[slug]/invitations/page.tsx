"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Send,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceBySlug } from "@/lib/actions/workspaces";
import {
  getWorkspaceInvitations,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
} from "@/lib/actions/workspace-invitations";
import { WorkspaceInvitationItem } from "@/lib/types";

export default function WorkspaceInvitationsPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [workspace, setWorkspace] = useState<any>(null);
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
    devLink?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    const wsRes = await getWorkspaceBySlug(slug);
    if (wsRes.success && wsRes.workspace) {
      setWorkspace(wsRes.workspace);

      const invRes = await getWorkspaceInvitations(wsRes.workspace.id);
      if (invRes.invitations) {
        setInvitations(invRes.invitations);
      }
    }
    setIsLoading(false);
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResend = async (invitationId: string) => {
    setActionMessage(null);
    const res = await resendWorkspaceInvitation(workspace.id, invitationId);
    if (res.success) {
      setActionMessage({
        type: "success",
        text: "Invitation resent with updated expiration.",
        devLink: res.devLink,
      });
      await loadData();
    } else {
      setActionMessage({
        type: "error",
        text: res.error || "Failed to resend invitation.",
      });
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    setActionMessage(null);
    const res = await revokeWorkspaceInvitation(workspace.id, invitationId);
    if (res.success) {
      setActionMessage({
        type: "success",
        text: "Invitation revoked.",
      });
      await loadData();
    } else {
      setActionMessage({
        type: "error",
        text: res.error || "Failed to revoke invitation.",
      });
    }
  };

  if (isLoading) {
    return (
      <ShellLayout>
        <div className="max-w-4xl mx-auto py-12 px-6 text-center text-slate-500 text-xs">
          Loading invitations...
        </div>
      </ShellLayout>
    );
  }

  if (!workspace) {
    return (
      <ShellLayout>
        <div className="max-w-md mx-auto py-16 px-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900">
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

  return (
    <ShellLayout>
      <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
        <div>
          <Link
            href={`/workspaces/${workspace.slug}/members`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Members</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Pending Invitations
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Outstanding invitations for {workspace.name}. Tokens expire after 7 days.
              </p>
            </div>
            <Link href={`/workspaces/${workspace.slug}/members`}>
              <Button variant="outline" size="sm">
                View Member Directory
              </Button>
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div
            className={`rounded-lg border p-3.5 text-xs space-y-1.5 ${
              actionMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            {actionMessage.devLink && (
              <div className="pt-1 text-[11px] font-mono break-all text-slate-700 border-t border-emerald-200/60 mt-1">
                <p className="font-semibold text-slate-900">Dev Acceptance Link:</p>
                <a
                  href={actionMessage.devLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {actionMessage.devLink}
                </a>
              </div>
            )}
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50 space-y-2">
            <Mail className="h-8 w-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              No pending invitations
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All invitations have either been accepted or expired. Invite colleagues from the team directory page.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-subtle divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {inv.email}
                      </span>
                      <Badge variant="outline" size="sm">
                        {inv.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                      {inv.inviter && (
                        <span>· Invited by {inv.inviter.fullName}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResend(inv.id)}
                    leftIcon={<Send className="h-3 w-3" />}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(inv.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
