"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";

export interface DirectMessagePeerItem {
  id: string; // The peer's user ID (DirectChannel target ID)
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
  conversationId?: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
}

/**
 * Returns eligible direct message peers in the active workspace.
 * Users can only direct message active members of the same workspace.
 */
export async function getWorkspaceDirectMessagePeers(
  workspaceId: string
): Promise<{ peers: DirectMessagePeerItem[]; error: string | null }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { peers: [], error: null };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    // 1. Get all active members in this workspace except current user
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: access.workspace.id,
        status: "ACTIVE",
        userId: { not: access.user.id },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
      orderBy: { user: { fullName: "asc" } },
    });

    // 2. Query existing direct conversation records for last active timestamps
    const conversations = await prisma.chatDirectConversation.findMany({
      where: {
        workspaceId: access.workspace.id,
        OR: [
          { user1Id: access.user.id },
          { user2Id: access.user.id },
        ],
      },
    });

    const convMap = new Map<string, { id: string; lastMessageAt: string | null }>();
    for (const c of conversations) {
      const peerId = c.user1Id === access.user.id ? c.user2Id : c.user1Id;
      convMap.set(peerId, {
        id: c.id,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      });
    }

    const peers: DirectMessagePeerItem[] = members.map((m) => {
      const conv = convMap.get(m.user.id);
      return {
        id: m.user.id, // Peer's User ID (used directly with DirectChannel)
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
        role: m.role,
        conversationId: conv?.id,
        lastMessageAt: conv?.lastMessageAt,
      };
    });

    return { peers, error: null };
  } catch (err: any) {
    return { peers: [], error: err.message || "Failed to load direct message peers." };
  }
}

/**
 * Ensures a direct conversation row exists between two members in a workspace.
 * Orders user IDs deterministically to maintain single-row symmetry.
 */
export async function getOrCreateDirectConversation(
  workspaceId: string,
  peerUserId: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    if (peerUserId === access.user.id) {
      return { success: false, error: "Cannot start a direct message with yourself.", conversation: null };
    }

    // Verify peer is active member of this workspace
    const peerMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.workspace.id,
        userId: peerUserId,
        status: "ACTIVE",
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
      },
    });

    if (!peerMember) {
      return {
        success: false,
        error: "Target user is not an active member of this workspace.",
        conversation: null,
      };
    }

    // Deterministic ordering: smaller UUID is user1Id
    const [user1Id, user2Id] =
      access.user.id < peerUserId
        ? [access.user.id, peerUserId]
        : [peerUserId, access.user.id];

    let conversation = await prisma.chatDirectConversation.findUnique({
      where: {
        workspaceId_user1Id_user2Id: {
          workspaceId: access.workspace.id,
          user1Id,
          user2Id,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.chatDirectConversation.create({
        data: {
          workspaceId: access.workspace.id,
          user1Id,
          user2Id,
          lastMessageAt: new Date(),
        },
      });
    } else {
      // Update last active
      conversation = await prisma.chatDirectConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    }

    revalidatePath("/chat");

    return {
      success: true,
      error: null,
      conversation: {
        id: conversation.id,
        peerId: peerUserId,
        peer: peerMember.user,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to initialize direct conversation.",
      conversation: null,
    };
  }
}

/**
 * Initiates a direct conversation with a colleague by email address.
 * Strictly verifies the email exists in the database and is an active member of this workspace.
 */
export async function startDirectConversationByEmail(
  workspaceId: string,
  email: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user exists in the database
    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, fullName: true, email: true },
    });

    if (!targetUser) {
      return {
        success: false,
        error: `No registered user found with email "${normalizedEmail}". Please ensure the user has created an account on SPARK first.`,
        conversation: null,
      };
    }

    if (targetUser.id === access.user.id) {
      return {
        success: false,
        error: "Cannot start a direct message with yourself.",
        conversation: null,
      };
    }

    return await getOrCreateDirectConversation(workspaceId, targetUser.id);
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to initialize conversation.",
      conversation: null,
    };
  }
}

