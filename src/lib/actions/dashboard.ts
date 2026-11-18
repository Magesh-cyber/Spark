"use server";

import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { WorkspaceRole, MembershipStatus } from "@/lib/types";

export interface WorkspaceDashboardData {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceType: "personal" | "organization";
  callerRole: WorkspaceRole;
  counts: {
    members: number;
    channels: number;
    directConversations: number;
    pendingInvitations: number;
  };
  recentMembers: Array<{
    id: string;
    userId: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: WorkspaceRole;
    joinedAt: string;
  }>;
  recentChannels: Array<{
    id: string;
    name: string;
    description: string | null;
    type: "PUBLIC" | "PRIVATE";
    createdAt: string;
  }>;
}

/**
 * Returns genuine, database-aggregated metrics and recent records for the workspace.
 * Guaranteed to be tenant-scoped and authorized.
 */
export async function getWorkspaceDashboardData(
  workspaceId: string
): Promise<{ success: boolean; data?: WorkspaceDashboardData; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: false, error: "Workspace context is still loading." };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const [
      memberCount,
      channelCount,
      dmCount,
      pendingInvitesCount,
      recentMembersRaw,
      recentChannelsRaw,
    ] = await Promise.all([
      prisma.workspaceMember.count({
        where: {
          workspaceId: access.workspace.id,
          status: "ACTIVE",
        },
      }),
      prisma.workspaceChatChannel.count({
        where: {
          workspaceId: access.workspace.id,
        },
      }),
      prisma.chatDirectConversation.count({
        where: {
          workspaceId: access.workspace.id,
        },
      }),
      prisma.workspaceInvitation.count({
        where: {
          workspaceId: access.workspace.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.workspaceMember.findMany({
        where: {
          workspaceId: access.workspace.id,
          status: "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
        take: 5,
      }),
      prisma.workspaceChatChannel.findMany({
        where: {
          workspaceId: access.workspace.id,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const data: WorkspaceDashboardData = {
      workspaceId: access.workspace.id,
      workspaceName: access.workspace.name,
      workspaceSlug: access.workspace.slug,
      workspaceType:
        access.workspace.type === "PERSONAL" ? "personal" : "organization",
      callerRole: access.member.role as WorkspaceRole,
      counts: {
        members: memberCount,
        channels: channelCount,
        directConversations: dmCount,
        pendingInvitations: pendingInvitesCount,
      },
      recentMembers: recentMembersRaw.map((m) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role as WorkspaceRole,
        joinedAt: m.joinedAt.toISOString(),
      })),
      recentChannels: recentChannelsRaw.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        createdAt: c.createdAt.toISOString(),
      })),
    };

    return { success: true, data };
  } catch (err: any) {
    console.error("Error loading workspace dashboard data:", err);
    return {
      success: false,
      error: err.message || "Failed to load workspace data.",
    };
  }
}

