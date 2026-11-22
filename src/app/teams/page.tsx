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
import {
  getWorkspaceMembers,
  searchApplicationUsers,
  addExistingUserToWorkspace,
  type ApplicationUserSearchResult,
} from "@/lib/actions/workspace-members";
import { inviteWorkspaceMember } from "@/lib/actions/workspace-invitations";
import { getOrCreateDirectConversation } from "@/lib/actions/chat-direct";
import { getWorkspaceJoinRequests, reviewWorkspaceJoinRequest } from "@/lib/actions/workspaces";
import { JoinByCodeModal } from "@/components/workspace/JoinByCodeModal";
import { clientMembersCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";
import { WorkspaceMemberItem, WorkspaceRole, WorkspaceJoinRequestItem } from "@/lib/types";
import {
  UserPlus,
  Mail,
  MessageSquare,
  Users,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  KeyRound,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Globe,
  UserCheck,
  Search,
  Sparkles,
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

  // Tab: "workspace" (workspace members) vs "directory" (find all users across SPARK)
  const [activeTab, setActiveTab] = useState<"workspace" | "directory">("workspace");
  const [directoryUsers, setDirectoryUsers] = useState<ApplicationUserSearchResult[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [directoryFeedback, setDirectoryFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [joinCodeModalOpen, setJoinCodeModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MANAGER" | "MEMBER" | "GUEST">("MEMBER");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    text: string;
    devLink?: string;
  } | null>(null);

  // Private workspace join requests
  const [joinRequests, setJoinRequests] = useState<WorkspaceJoinRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  const isPrivileged =
    activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "ADMIN";

  const fetchJoinRequests = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") return;
    if (activeWorkspace.role !== "OWNER" && activeWorkspace.role !== "ADMIN") return;
    try {
      setIsLoadingRequests(true);
      const res = await getWorkspaceJoinRequests(activeWorkspace.id);
      if (res.requests) {
        setJoinRequests(res.requests);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingRequests(false);
    }
  }, [activeWorkspace?.id, activeWorkspace?.role]);

  const handleReviewRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
    if (!activeWorkspace?.id) return;
    setReviewingRequestId(requestId);
    try {
      const res = await reviewWorkspaceJoinRequest(activeWorkspace.id, requestId, action);
      if (res.success) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (action === "APPROVE") {
          await fetchMembers(true);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setReviewingRequestId(null);
    }
  };

  const fetchMembers = useCallback(
    async (force = false) => {
      if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
        setIsLoading(false);
        return;
      }

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
    fetchJoinRequests();
  }, [fetchMembers, fetchJoinRequests]);

  const fetchDirectoryUsers = useCallback(async (query: string) => {
    setIsLoadingDirectory(true);
    setDirectoryFeedback(null);
    try {
      const res = await searchApplicationUsers(query, activeWorkspace?.id);
      if (res.error) {
        setDirectoryFeedback({ type: "error", text: res.error });
      } else {
        setDirectoryUsers(res.users);
      }
    } catch {
      setDirectoryFeedback({ type: "error", text: "Failed to search application user directory." });
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (activeTab === "directory") {
      fetchDirectoryUsers(directorySearch);
    }
  }, [activeTab, directorySearch, fetchDirectoryUsers]);

  const handleAddToWorkspace = async (targetUserId: string) => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") return;
    setAddingUserId(targetUserId);
    setDirectoryFeedback(null);
    try {
      const res = await addExistingUserToWorkspace(activeWorkspace.id, targetUserId, "MEMBER");
      if (res.success) {
        setDirectoryFeedback({
          type: "success",
          text: "User added to this workspace successfully!",
        });
        await fetchMembers(true);
        await fetchDirectoryUsers(directorySearch);
      } else {
        setDirectoryFeedback({ type: "error", text: res.error || "Failed to add user." });
      }
    } catch {
      setDirectoryFeedback({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setAddingUserId(null);
    }
  };

  const handleCopyEmail = (userId: string, emailStr: string) => {
    navigator.clipboard
      ?.writeText(emailStr)
      .then(() => {
        setCopiedEmailId(userId);
        setTimeout(() => setCopiedEmailId((prev) => (prev === userId ? null : prev)), 2000);
      })
      .catch(() => {});
  };

  const handleStartChatWithUser = (peer: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role?: string | null;
  }) => {
    if (!activeWorkspace?.id || peer.id === currentUser.id) {
      router.push("/chat");
      return;
    }
    if (chat) {
      chat.setActiveConversation({
        type: "direct",
        id: peer.id,
        name: peer.fullName,
        nexconnTargetId: peer.id,
        peer: {
          id: peer.id,
          fullName: peer.fullName,
          avatarUrl: peer.avatarUrl,
          email: peer.email,
          role: peer.role || "MEMBER",
        },
      });
    }
    getOrCreateDirectConversation(activeWorkspace.id, peer.id).catch(() => {});
    router.push("/chat");
  };

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

  const roleBadgeVariant: Record<WorkspaceRole, "default" | "violet" | "success" | "warning"> = {
    OWNER: "warning",
    ADMIN: "violet",
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                onClick={() => setJoinCodeModalOpen(true)}
              >
                Join with Code
              </Button>
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
            </div>
          }
        />

        {/* Pending Join Requests (Visible to Owner/Admin) */}
        {isPrivileged && joinRequests.length > 0 && (
          <div className="rounded-[12px] border border-[var(--spark-accent)]/30 bg-[var(--spark-highlight)]/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--spark-accent)]" />
                <h4 className="text-xs font-semibold text-[var(--spark-text-primary)]">
                  Pending Join Requests ({joinRequests.length})
                </h4>
              </div>
              <span className="text-[11px] text-[var(--spark-text-muted)]">
                Review users requesting access via the 6-character join code
              </span>
            </div>

            <div className="divide-y divide-[var(--spark-border)]/40 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)]">
              {joinRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={req.user.fullName || req.user.email}
                      src={req.user.avatarUrl || undefined}
                      size="sm"
                      className="border border-[var(--spark-border)]"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--spark-text-primary)] truncate">
                        {req.user.fullName || "User"}
                      </p>
                      <p className="text-[11px] text-[var(--spark-text-muted)] truncate">
                        {req.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      isLoading={reviewingRequestId === req.id}
                      onClick={() => handleReviewRequest(req.id, "REJECT")}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-7 text-xs"
                      isLoading={reviewingRequestId === req.id}
                      onClick={() => handleReviewRequest(req.id, "APPROVE")}
                    >
                      Approve & Admit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs: Workspace Members vs Find All Users */}
        <div className="flex items-center gap-2 border-b border-[var(--spark-border)] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("workspace")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${
              activeTab === "workspace"
                ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Workspace Members</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "workspace"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--spark-surface)] text-[var(--spark-text-muted)] border border-[var(--spark-border)]"
              }`}
            >
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${
              activeTab === "directory"
                ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Find All SPARK Users</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "directory"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--spark-surface)] text-[var(--spark-text-muted)] border border-[var(--spark-border)]"
              }`}
            >
              Directory
            </span>
          </button>
        </div>

        {activeTab === "workspace" ? (
          <>
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search active members by name, email or role..."
            />

            {isLoading ? (
              <div className="py-6">
                <LoadingState type="cards" count={4} />
              </div>
            ) : error ? (
              <div className="rounded-[10px] border border-rose-500/30 bg-rose-500/8 p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
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
              <div className="py-12 text-center space-y-3">
                <p className="text-xs text-[var(--spark-text-secondary)]">
                  No workspace members matched your query &ldquo;{searchQuery}&rdquo;.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Globe className="h-3.5 w-3.5 text-[var(--spark-accent)]" />}
                  onClick={() => {
                    setDirectorySearch(searchQuery);
                    setActiveTab("directory");
                  }}
                >
                  Search all registered SPARK users for &ldquo;{searchQuery}&rdquo; &rarr;
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMembers.map((member) => (
                  <Card
                    key={member.id}
                    className="hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={member.user.fullName}
                          src={member.user.avatarUrl || undefined}
                          size="lg"
                          status={
                            (chat?.onlineUserIds &&
                              (chat.onlineUserIds[member.userId] ||
                                chat.onlineUserIds[member.userId.toLowerCase()])) ||
                            member.userId === currentUser.id
                              ? "online"
                              : "offline"
                          }
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-[var(--spark-text-primary)] leading-tight truncate">
                              {member.user.fullName}
                            </h4>
                            {member.userId === currentUser.id && (
                              <span className="text-[10px] text-[var(--spark-highlight-text)] font-semibold bg-[var(--spark-highlight)] px-1.5 py-0.5 rounded-[4px]">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--spark-text-secondary)] truncate mt-0.5">
                            {member.user.email}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Badge variant={roleBadgeVariant[member.role] || "default"} size="sm">
                              {member.role}
                            </Badge>
                            <span className="text-[10px] text-[var(--spark-text-muted)]">
                              Joined {new Date(member.joinedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <a
                          href={`mailto:${member.user.email}`}
                          className="p-1.5 rounded-[6px] border border-[var(--spark-border)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
                          aria-label="Send email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleStartChat(member.userId)}
                          className="p-1.5 rounded-[6px] border border-[var(--spark-border)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] hover:border-[var(--spark-accent)]/30 transition-colors duration-150"
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
          </>
        ) : (
          /* Global Application User Directory Tab */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--spark-text-muted)]" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Find users across SPARK by username (full name) or email ID..."
                className="w-full h-10 pl-10 pr-9 rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] focus:ring-2 focus:ring-[var(--spark-accent)]/20 transition-all shadow-2xs"
              />
              {directorySearch && (
                <button
                  type="button"
                  onClick={() => setDirectorySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {directoryFeedback && (
              <div
                className={`rounded-[8px] border p-3 text-xs flex items-center justify-between gap-2 ${
                  directoryFeedback.type === "success"
                    ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {directoryFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  )}
                  <span>{directoryFeedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectoryFeedback(null)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {isLoadingDirectory ? (
              <div className="py-6">
                <LoadingState type="cards" count={4} />
              </div>
            ) : directoryUsers.length === 0 ? (
              <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8 text-center space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-[var(--spark-highlight)] text-[var(--spark-accent)] flex items-center justify-center mb-2">
                  <Globe className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--spark-text-primary)]">
                  {directorySearch ? "No users matched your search" : "No users in directory"}
                </h4>
                <p className="text-[11px] text-[var(--spark-text-secondary)] max-w-sm mx-auto">
                  {directorySearch
                    ? `No registered SPARK users found matching "${directorySearch}". Check spelling or try searching by email address.`
                    : "All users registered on the SPARK platform will appear here."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {directoryUsers.map((user) => (
                  <Card
                    key={user.id}
                    className="hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={user.fullName}
                          src={user.avatarUrl || undefined}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-[var(--spark-text-primary)] leading-tight truncate">
                              {user.fullName}
                            </h4>
                            {user.isSelf && (
                              <span className="text-[10px] text-[var(--spark-highlight-text)] font-semibold bg-[var(--spark-highlight)] px-1.5 py-0.5 rounded-[4px]">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[11px] text-[var(--spark-text-secondary)] truncate">
                              {user.email}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(user.id, user.email)}
                              className="text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                              title="Copy email ID"
                            >
                              {copiedEmailId === user.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            {user.isCurrentWorkspaceMember ? (
                              <Badge
                                variant={
                                  roleBadgeVariant[user.roleInCurrentWorkspace || "MEMBER"] ||
                                  "default"
                                }
                                size="sm"
                              >
                                Member · {user.roleInCurrentWorkspace}
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--spark-surface-subtle)] text-[var(--spark-text-muted)] border border-[var(--spark-border)]">
                                <UserCheck className="h-2.5 w-2.5" />
                                SPARK User
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--spark-text-muted)]">
                              Joined {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {!user.isCurrentWorkspaceMember && !user.isSelf && isPrivileged && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold text-[var(--spark-accent)] border-[var(--spark-accent)]/30 hover:bg-[var(--spark-highlight)]"
                            isLoading={addingUserId === user.id}
                            onClick={() => handleAddToWorkspace(user.id)}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>
                        )}

                        {!user.isSelf && (
                          <button
                            type="button"
                            onClick={() =>
                              handleStartChatWithUser({
                                id: user.id,
                                fullName: user.fullName,
                                email: user.email,
                                avatarUrl: user.avatarUrl,
                                role: user.roleInCurrentWorkspace || "MEMBER",
                              })
                            }
                            className="p-1.5 rounded-[6px] border border-[var(--spark-border)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] hover:border-[var(--spark-accent)]/30 transition-colors duration-150"
                            title="Start direct conversation"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <a
                          href={`mailto:${user.email}`}
                          className="p-1.5 rounded-[6px] border border-[var(--spark-border)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
                          title="Send email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Real Invite Member Modal (Glassmorphic Overlay) */}
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-[#0D0B14]/55 backdrop-blur-sm transition-opacity"
              onClick={() => setInviteModalOpen(false)}
            />
            <div className="relative z-50 w-full max-w-md rounded-[14px] border spark-glass p-6 text-[var(--spark-text-primary)] shadow-modal animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--spark-border)]">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[var(--spark-accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                    Invite Member to Workspace
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-[6px] p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inviteFeedback && (
                <div
                  className={`mt-4 rounded-[8px] border p-3 text-xs flex items-start gap-2 ${
                    inviteFeedback.type === "success"
                      ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {inviteFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p>{inviteFeedback.text}</p>
                    {inviteFeedback.devLink && (
                      <div className="pt-1">
                        <span className="text-[11px] font-semibold block text-[var(--spark-text-primary)]">
                          Direct Invitation Link:
                        </span>
                        <a
                          href={inviteFeedback.devLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[var(--spark-accent)] underline break-all flex items-center gap-1"
                        >
                          <span>Accept Invitation Link</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6-Character Quick Join Code Banner */}
              {activeWorkspace?.joinCode && (
                <div className="mt-4 p-3 rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                      <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                        Workspace Join Code
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          activeWorkspace.isPrivate
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        }`}
                      >
                        {activeWorkspace.isPrivate
                          ? "Private · Requires Approval"
                          : "Public · Instant Join"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeWorkspace.joinCode) {
                          navigator.clipboard.writeText(activeWorkspace.joinCode);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-[var(--spark-accent)] hover:underline"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-mono font-bold tracking-[0.25em] px-2.5 py-1 rounded bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-accent)]">
                      {activeWorkspace.joinCode}
                    </span>
                    <p className="text-[11px] text-[var(--spark-text-muted)] text-right flex-1">
                      Share this code with colleagues to join directly without waiting for email.
                    </p>
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
                  <label className="text-xs font-medium text-[var(--spark-text-secondary)]">
                    Assigned Workspace Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["MEMBER", "MANAGER", "ADMIN", "GUEST"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`rounded-[8px] border p-2.5 text-xs font-medium text-left transition-colors duration-150 ${
                          inviteRole === r
                            ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)]"
                            : "border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
                        }`}
                      >
                        <div className="font-semibold">{r}</div>
                        <div className="text-[10px] text-[var(--spark-text-muted)] mt-0.5">
                          {r === "ADMIN" && "Full administrative control"}
                          {r === "MANAGER" && "Manage channels & members"}
                          {r === "MEMBER" && "Collaborate & communicate"}
                          {r === "GUEST" && "Single-channel view"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--spark-border)]">
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

        {/* Global Join by Code Modal */}
        <JoinByCodeModal
          isOpen={joinCodeModalOpen}
          onClose={() => setJoinCodeModalOpen(false)}
        />
      </div>
    </ShellLayout>
  );
}
