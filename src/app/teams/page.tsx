"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/data/FilterBar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useWorkspace } from "@/lib/workspace-context";
import { useNexconnChatOptional } from "@/components/chat/NexconnChatProvider";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { inviteWorkspaceMember } from "@/lib/actions/workspace-invitations";
import { getOrCreateDirectConversation } from "@/lib/actions/chat-direct";
import { clientMembersCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";
import { WorkspaceMemberItem, WorkspaceRole } from "@/lib/types";
import { canInviteMembers } from "@/lib/permissions";
import {
  UserPlus,
  Mail,
  MessageSquare,
  Users,
  Shield,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";

export default function TeamsPage() {
  const router = useRouter();
  const { activeWorkspace, currentUser } = useWorkspace();
  const chat = useNexconnChatOptional();
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(() => {
    if (activeWorkspace?.id && clientMembersCache.has(activeWorkspace.id)) {
      return clientMembersCache.get(activeWorkspace.id)!;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !activeWorkspace?.id || !clientMembersCache.has(activeWorkspace.id);
  });
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MANAGER" | "MEMBER" | "GUEST">("MEMBER");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    text: string;
    devLink?: string;
  } | null>(null);

  const fetchMembers = useCallback(
    async (force = false) => {
      if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
        setIsLoading(false);
        return;
      }

      // Hydrate immediately from shared cache if available (0ms render)
      const cached = clientMembersCache.get(activeWorkspace.id);
      if (cached) {
        setMembers(cached);
        setIsLoading(false);
        if (!force && clientMembersCache.isFresh(activeWorkspace.id)) {
          return;
        }
      } else {
        setIsLoading(true);
      }

      setError("");
      try {
        const res = await getWorkspaceMembers(activeWorkspace.id);
        if (res.error) {
          setError(res.error);
          if (!cached) setMembers([]);
        } else {
          const fresh = res.members || [];
          clientMembersCache.set(activeWorkspace.id, fresh);
          setMembers(fresh);
        }
      } catch {
        setError("An unexpected error occurred while loading team members.");
        if (!cached) setMembers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeWorkspace?.id]
  );

  useEffect(() => {
    fetchMembers(false);
  }, [fetchMembers]);

  useEffect(() => {
    return subscribeBootstrap((payload) => {
      if (payload.members && payload.activeWorkspace?.id === activeWorkspace?.id) {
        setMembers(payload.members);
        setIsLoading(false);
      }
    });
  }, [activeWorkspace?.id]);

  const handleStartChat = (peerUserId: string) => {
    if (!activeWorkspace?.id || peerUserId === currentUser.id) {
      router.push("/chat");
      return;
    }
    const targetMember = members.find((m) => m.user.id === peerUserId);
    if (chat && targetMember) {
      chat.setActiveConversation({
        type: "direct",
        id: targetMember.user.id,
        name: targetMember.user.fullName,
        nexconnTargetId: targetMember.user.id,
        peer: {
          id: targetMember.user.id,
          fullName: targetMember.user.fullName,
          avatarUrl: targetMember.user.avatarUrl || null,
          email: targetMember.user.email,
          role: targetMember.role,
        },
      });
    }
    // Persist direct conversation row asynchronously so navigation to /chat is instantaneous
    getOrCreateDirectConversation(activeWorkspace.id, peerUserId).catch(() => {});
    router.push("/chat");
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !inviteEmail.trim()) return;

    setIsSubmittingInvite(true);
    setInviteFeedback(null);

    try {
      const res = await inviteWorkspaceMember(activeWorkspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.success) {
        setInviteFeedback({
          type: "success",
          text: `Invitation created and dispatched for ${inviteEmail.trim()}.`,
          devLink: res.devLink,
        });
        setInviteEmail("");
        // Reload member directory
        await fetchMembers(true);
      } else {
        setInviteFeedback({
          type: "error",
          text: res.error || "Failed to send invitation.",
        });
      }
    } catch {
      setInviteFeedback({
        type: "error",
        text: "Failed to dispatch invitation.",
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const roleBadgeVariant: Record<WorkspaceRole, "default" | "info" | "success" | "warning"> = {
    OWNER: "warning",
    ADMIN: "info",
    MANAGER: "default",
    MEMBER: "default",
    GUEST: "default",
  };

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      m.user.fullName.toLowerCase().includes(query) ||
      m.user.email.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query)
    );
  });

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="People & Teams"
          description={`Verified members and role permissions for ${activeWorkspace?.name || "your workspace"}.`}
          actions={
            <Button
              size="sm"
              variant="primary"
              leftIcon={<UserPlus className="h-3.5 w-3.5" />}
              onClick={() => {
                setInviteFeedback(null);
                setInviteModalOpen(true);
              }}
            >
              Invite Member
            </Button>
          }
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search active members by name, email or role..."
        />

        {isLoading ? (
          <div className="py-12">
            <LoadingState type="cards" count={4} />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-600 mb-2" />
            <p className="text-xs font-semibold text-red-900">{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => fetchMembers(true)}
            >
              Try Again
            </Button>
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No team members yet"
            description="Invite your colleagues to start collaborating in this workspace."
            actionLabel="Invite Member"
            onAction={() => {
              setInviteFeedback(null);
              setInviteModalOpen(true);
            }}
          />
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No team members matched your search query &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMembers.map((member) => (
              <Card key={member.id} className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={member.user.fullName}
                      src={member.user.avatarUrl || undefined}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-900 leading-tight truncate">
                          {member.user.fullName}
                        </h4>
                        {member.userId === currentUser.id && (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{member.user.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant={roleBadgeVariant[member.role] || "default"} size="sm">
                          {member.role}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <a
                      href={`mailto:${member.user.email}`}
                      className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                      aria-label="Send email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleStartChat(member.userId)}
                      className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      aria-label="Open chat"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Real Invite Member Modal */}
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
              onClick={() => setInviteModalOpen(false)}
            />
            <div className="relative z-50 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-modal animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Invite Member to Workspace
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inviteFeedback && (
                <div
                  className={`mt-4 rounded-lg border p-3 text-xs flex items-start gap-2 ${
                    inviteFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {inviteFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p>{inviteFeedback.text}</p>
                    {inviteFeedback.devLink && (
                      <div className="pt-1">
                        <span className="text-[11px] font-semibold block text-slate-700">
                          Direct Invitation Link:
                        </span>
                        <a
                          href={inviteFeedback.devLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 underline break-all flex items-center gap-1"
                        >
                          <span>Accept Invitation Link</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
                <Input
                  label="Colleague's Email Address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Assigned Workspace Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["MEMBER", "MANAGER", "ADMIN", "GUEST"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`rounded-lg border p-2 text-xs font-medium text-left transition-colors ${
                          inviteRole === r
                            ? "border-blue-600 bg-blue-50/70 text-blue-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-semibold">{r}</div>
                        <div className="text-[10px] text-slate-500">
                          {r === "ADMIN" && "Full administrative control"}
                          {r === "MANAGER" && "Manage channels & members"}
                          {r === "MEMBER" && "Collaborate & communicate"}
                          {r === "GUEST" && "Single-channel view"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInviteModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingInvite}
                  >
                    Send Invitation
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
