"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { prisma } from "@/lib/prisma";
import type { NotificationItem, NotificationType } from "@/lib/types";
import type { NotificationType as PrismaNotificationType } from "@prisma/client";

function toPrismaNotificationType(type: NotificationType): PrismaNotificationType {
  switch (type) {
    case "CHAT_DM":
    case "mention":
      return "CHAT_DM";
    case "CHAT_CHANNEL":
      return "CHAT_CHANNEL";
    case "WORKSPACE_INVITATION":
      return "WORKSPACE_INVITATION";
    case "WORKSPACE_JOIN_REQUEST":
      return "WORKSPACE_JOIN_REQUEST";
    case "MEMBER_JOINED":
      return "MEMBER_JOINED";
    case "TASK_ASSIGNED":
    case "task":
      return "TASK_ASSIGNED";
    case "TASK_DEADLINE":
      return "TASK_DEADLINE";
    case "MEETING_SCHEDULED":
    case "meeting":
      return "MEETING_SCHEDULED";
    case "CALENDAR_EVENT":
      return "CALENDAR_EVENT";
    case "SYSTEM":
    case "system":
    default:
      return "SYSTEM";
  }
}

/**
 * Maps a Prisma Notification row to the frontend NotificationItem contract.
 */
function mapNotificationRow(row: any): NotificationItem {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    title: row.title,
    message: row.message,
    timestamp: row.createdAt.toISOString(),
    read: row.isRead,
    type: row.type as NotificationType,
    link: row.link || undefined,
    metadata: (row.metadata as Record<string, any>) || null,
  };
}

/**
 * Retrieves all genuine notifications for the authenticated user.
 * Strictly user-scoped — zero possibility of notification bleed across users.
 */
export async function getUserNotifications(
  limit = 40
): Promise<{ success: boolean; notifications: NotificationItem[]; error?: string }> {
  const authUser = await getAuthenticatedUser();
  if (!authUser || !authUser.email) {
    return { success: false, notifications: [], error: "Unauthenticated" };
  }

  try {
    // 1. Sync any pending real workspace invitations into notifications so the user never misses them
    const pendingInvites = await prisma.workspaceInvitation.findMany({
      where: {
        email: authUser.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: { select: { name: true } },
        inviter: { select: { fullName: true } },
      },
    });

    for (const inv of pendingInvites) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: authUser.id,
          type: "WORKSPACE_INVITATION",
          workspaceId: inv.workspaceId,
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: authUser.id,
            workspaceId: inv.workspaceId,
            type: "WORKSPACE_INVITATION",
            title: "Workspace Invitation",
            message: `${inv.inviter?.fullName || "A team admin"} invited you to join ${inv.workspace.name} as ${inv.role}.`,
            link: "/teams",
            metadata: {
              invitationId: inv.id,
              workspaceId: inv.workspaceId,
              role: inv.role,
            },
          },
        });
      }
    }

    // 2. Fetch all real notifications for this authenticated user
    const rows = await prisma.notification.findMany({
      where: {
        userId: authUser.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return {
      success: true,
      notifications: rows.map(mapNotificationRow),
    };
  } catch (err: any) {
    console.error("[Notifications] Failed to load notifications:", err);
    return {
      success: false,
      notifications: [],
      error: err?.message || "Failed to load notifications",
    };
  }
}

/**
 * Creates a genuine, database-backed notification for a verified user.
 * Strictly verifies target user exists to eliminate notification hallucinations.
 */
export async function createNotification(params: {
  userId: string;
  workspaceId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; notification?: NotificationItem; error?: string }> {
  try {
    // Verify target user genuinely exists in database
    const targetUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return { success: false, error: "Target user not found. Cannot create notification." };
    }

    const created = await prisma.notification.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId || null,
        type: toPrismaNotificationType(params.type),
        title: params.title.slice(0, 150),
        message: params.message.slice(0, 500),
        link: params.link || null,
        metadata: params.metadata || undefined,
      },
    });

    return {
      success: true,
      notification: mapNotificationRow(created),
    };
  } catch (err: any) {
    console.error("[Notifications] Failed to create notification:", err);
    return { success: false, error: err?.message || "Failed to create notification" };
  }
}

/**
 * Creates notifications for all members of a workspace (e.g. new channel created, workspace announcement).
 * Excludes the author so they do not receive an echo notification.
 */
export async function notifyWorkspaceMembers(params: {
  workspaceId: string;
  excludeUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}): Promise<{ count: number }> {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: params.workspaceId,
        status: "ACTIVE",
        ...(params.excludeUserId ? { userId: { not: params.excludeUserId } } : {}),
      },
      select: { userId: true },
    });

    if (members.length === 0) return { count: 0 };

    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        workspaceId: params.workspaceId,
        type: toPrismaNotificationType(params.type),
        title: params.title.slice(0, 150),
        message: params.message.slice(0, 500),
        link: params.link || null,
        metadata: params.metadata || undefined,
      })),
    });

    return { count: members.length };
  } catch (err) {
    console.error("[Notifications] Failed to broadcast workspace notifications:", err);
    return { count: 0 };
  }
}

/**
 * Records a real-time chat notification (DM received or channel mention) for a user.
 */
export async function recordChatNotification(params: {
  recipientUserId: string;
  senderName: string;
  workspaceId: string;
  conversationType: "channel" | "direct";
  channelName?: string;
  messageText: string;
}): Promise<boolean> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return false;

  // Don't notify yourself
  if (params.recipientUserId === authUser.id) return true;

  try {
    const isDirect = params.conversationType === "direct";
    const title = isDirect
      ? `New message from ${params.senderName}`
      : `#${params.channelName || "channel"} - Mention by ${params.senderName}`;

    const cleanText = params.messageText.length > 120
      ? `${params.messageText.slice(0, 120)}...`
      : params.messageText;

    await createNotification({
      userId: params.recipientUserId,
      workspaceId: params.workspaceId,
      type: isDirect ? "CHAT_DM" : "CHAT_CHANNEL",
      title,
      message: cleanText || "Sent an attachment",
      link: "/chat",
      metadata: {
        senderId: authUser.id,
        conversationType: params.conversationType,
        channelName: params.channelName,
      },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Marks a specific notification as read by its ID.
 * Strictly guarantees callers can only modify their own notifications.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return { success: false, error: "Unauthenticated" };
  }

  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: authUser.id,
      },
      data: {
        isRead: true,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark notification read" };
  }
}

/**
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return { success: false, error: "Unauthenticated" };
  }

  try {
    await prisma.notification.updateMany({
      where: {
        userId: authUser.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark all read" };
  }
}

/**
 * Clears or deletes a single notification for the authenticated user.
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return { success: false, error: "Unauthenticated" };
  }

  try {
    await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId: authUser.id,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete notification" };
  }
}
