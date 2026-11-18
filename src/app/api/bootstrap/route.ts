import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { prisma } from "@/lib/prisma";
import { ensurePersonalWorkspace } from "@/lib/actions/workspaces";
import { issueNexconnChatToken, syncNexconnGroupChannel } from "@/lib/nexconn/server";
import type {
  Workspace,
  WorkspaceRole,
  WorkspaceMemberItem,
  MembershipStatus,
  User,
} from "@/lib/types";
import type { WorkspaceDashboardData } from "@/lib/actions/dashboard";
import type { ChatChannelItem } from "@/lib/actions/chat-channels";
import type { DirectMessagePeerItem } from "@/lib/actions/chat-direct";

export interface BootstrapPayload {
  user: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  dashboard: WorkspaceDashboardData;
  members: WorkspaceMemberItem[];
  channels: ChatChannelItem[];
  directPeers: DirectMessagePeerItem[];
  chatToken: {
    token: string;
    userId: string;
    appKey?: string;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const requestedWorkspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      cookies().get("spark_active_workspace_id")?.value ||
      null;

    // 1. Fetch user profile + all active memberships in parallel
    const [profile, initialMemberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, fullName: true, email: true, avatarUrl: true },
      }),
      prisma.workspaceMember.findMany({
        where: {
          userId: authUser.id,
          status: "ACTIVE",
        },
        include: {
          workspace: {
            include: {
              _count: {
                select: { members: true },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      }),
    ]);

    let memberships = initialMemberships;

    const fullName =
      profile?.fullName ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "SPARK User";

    // Ensure personal workspace exists only if user has none
    const hasPersonalWorkspace = memberships.some(
      (m) => m.workspace.type === "PERSONAL"
    );
    if (!hasPersonalWorkspace) {
      await ensurePersonalWorkspace(authUser.id, authUser.email || "", fullName);
      memberships = await prisma.workspaceMember.findMany({
        where: {
          userId: authUser.id,
          status: "ACTIVE",
        },
        include: {
          workspace: {
            include: {
              _count: {
                select: { members: true },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
    }

    const workspaces: Workspace[] = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      type: m.workspace.type === "PERSONAL" ? "personal" : "organization",
      role: m.role as WorkspaceRole,
      avatarUrl: m.workspace.avatarUrl,
      description: m.workspace.description,
      memberCount: m.workspace._count.members,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
    }));

    // Strict tenant check: active workspace MUST be one of the user's verified active memberships
    const activeMembership =
      memberships.find(
        (m) =>
          requestedWorkspaceId &&
          (m.workspace.id === requestedWorkspaceId ||
            m.workspace.slug === requestedWorkspaceId)
      ) ||
      memberships.find((m) => m.workspace.type === "PERSONAL") ||
      memberships[0];

    if (!activeMembership) {
      return NextResponse.json(
        { error: "No active workspaces available." },
        { status: 404 }
      );
    }

    const activeWorkspace = workspaces.find(
      (w) => w.id === activeMembership.workspace.id
    )!;
    const activeWsId = activeWorkspace.id;
    const callerRole = activeMembership.role as WorkspaceRole;

    // 2. Fetch EVERYTHING for the active workspace + Nexconn chat token in ONE parallel batch
    const [
      allMembersRaw,
      channelsRaw,
      directConversationsRaw,
      pendingInvitesCount,
      nexconnTokenResult,
    ] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: {
          workspaceId: activeWsId,
          status: "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      }),
      prisma.workspaceChatChannel.findMany({
        where: {
          workspaceId: activeWsId,
          OR: [
            { type: "PUBLIC" },
            { members: { some: { userId: authUser.id } } },
            ...(callerRole === "OWNER" || callerRole === "ADMIN"
              ? [{ type: "PRIVATE" as const }]
              : []),
          ],
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      prisma.chatDirectConversation.findMany({
        where: {
          workspaceId: activeWsId,
        },
      }),
      prisma.workspaceInvitation.count({
        where: {
          workspaceId: activeWsId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      issueNexconnChatToken({
        userId: authUser.id,
        name: fullName,
        avatarUrl: profile?.avatarUrl || authUser.user_metadata?.avatar_url || null,
      }).catch((err) => {
        console.warn("[Bootstrap Nexconn Token Warning]:", err?.message || err);
        return null;
      }),
    ]);

    // Trigger non-blocking background Nexconn group sync for accessible channels
    if (channelsRaw.length > 0) {
      Promise.all(
        channelsRaw.map((ch) =>
          syncNexconnGroupChannel(ch.nexconnChannelId, ch.name, [authUser.id])
        )
      ).catch(() => {});
    }

    // Format Members (for /teams)
    const members: WorkspaceMemberItem[] = allMembersRaw.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      status: m.status as MembershipStatus,
      joinedAt: m.joinedAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
      },
    }));

    // Format Channels (for /chat)
    const channels: ChatChannelItem[] = channelsRaw.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      nexconnChannelId: c.nexconnChannelId,
      name: c.name,
      description: c.description,
      type: c.type as "PUBLIC" | "PRIVATE",
      isDefault: c.isDefault,
      createdById: c.createdById,
      createdAt: c.createdAt.toISOString(),
    }));

    // Format Direct Peers (for /chat)
    const myDirectConvs = directConversationsRaw.filter(
      (c) => c.user1Id === authUser.id || c.user2Id === authUser.id
    );
    const convMap = new Map<string, { id: string; lastMessageAt: string | null }>();
    for (const c of myDirectConvs) {
      const peerId = c.user1Id === authUser.id ? c.user2Id : c.user1Id;
      convMap.set(peerId, {
        id: c.id,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      });
    }

    const directPeers: DirectMessagePeerItem[] = allMembersRaw
      .filter((m) => m.user.id !== authUser.id)
      .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName))
      .map((m) => {
        const conv = convMap.get(m.user.id);
        return {
          id: m.user.id,
          fullName: m.user.fullName,
          avatarUrl: m.user.avatarUrl,
          email: m.user.email,
          role: m.role,
          conversationId: conv?.id,
          lastMessageAt: conv?.lastMessageAt,
        };
      });

    // Format Dashboard Data (for / Overview & /insights)
    const recentChannelsSorted = [...channelsRaw]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const dashboard: WorkspaceDashboardData = {
      workspaceId: activeWsId,
      workspaceName: activeWorkspace.name,
      workspaceSlug: activeWorkspace.slug,
      workspaceType:
        activeWorkspace.type === "personal" || activeWorkspace.type === "PERSONAL"
          ? "personal"
          : "organization",
      callerRole,
      counts: {
        members: allMembersRaw.length,
        channels: channelsRaw.length,
        directConversations: directConversationsRaw.length,
        pendingInvitations: pendingInvitesCount,
      },
      recentMembers: allMembersRaw.slice(0, 5).map((m) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role as WorkspaceRole,
        joinedAt: m.joinedAt.toISOString(),
      })),
      recentChannels: recentChannelsSorted.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type as "PUBLIC" | "PRIVATE",
        createdAt: c.createdAt.toISOString(),
      })),
    };

    const user: User = {
      id: authUser.id,
      name: fullName,
      email: profile?.email || authUser.email || "",
      role: callerRole === "OWNER" ? "Workspace Owner" : callerRole,
      title: callerRole === "OWNER" ? "Account Owner" : "Team Member",
      avatarUrl: profile?.avatarUrl || authUser.user_metadata?.avatar_url || undefined,
    };

    const payload: BootstrapPayload = {
      user,
      workspaces,
      activeWorkspace,
      dashboard,
      members,
      channels,
      directPeers,
      chatToken: nexconnTokenResult
        ? {
            token: nexconnTokenResult.token,
            userId: authUser.id,
            appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY,
          }
        : null,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[Bootstrap API Error]:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to load workspace bootstrap data." },
      { status: 500 }
    );
  }
}
