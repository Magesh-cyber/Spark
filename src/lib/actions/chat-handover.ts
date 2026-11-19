"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { z } from "zod";

export interface HandoverSignOffItem {
  id: string;
  messageId: string;
  shiftPeriod: string;
  userId: string;
  userName: string;
  createdAt: string;
  timestamp: number;
}

const handoverInputSchema = z.object({
  shiftPeriod: z.string().trim().min(2, "Shift period is required (e.g. Morning Shift).").max(60),
  completed: z.string().trim().min(3, "Completed work description is required."),
  inProgress: z.string().trim().default("None"),
  blockers: z.string().trim().default("None reported"),
  nextSteps: z.string().trim().min(3, "Incoming shift instructions are required."),
});

export type CreateShiftHandoverInput = z.infer<typeof handoverInputSchema>;

/**
 * Returns all handover acknowledgments recorded for a given channel in a workspace.
 */
export async function getChannelHandoverAcknowledgments(
  workspaceId: string,
  channelId: string
): Promise<{ acknowledgments: Record<string, HandoverSignOffItem[]>; error: string | null }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const records = await prisma.chatHandoverAcknowledgment.findMany({
      where: {
        workspaceId: access.workspace.id,
        channelId,
      },
      orderBy: { createdAt: "asc" },
    });

    const map: Record<string, HandoverSignOffItem[]> = {};
    for (const r of records) {
      if (!map[r.messageId]) map[r.messageId] = [];
      map[r.messageId].push({
        id: r.id,
        messageId: r.messageId,
        shiftPeriod: r.shiftPeriod,
        userId: r.userId,
        userName: r.userName,
        createdAt: r.createdAt.toISOString(),
        timestamp: r.createdAt.getTime(),
      });
    }

    return { acknowledgments: map, error: null };
  } catch (err: any) {
    return { acknowledgments: {}, error: err.message || "Failed to load acknowledgments." };
  }
}

/**
 * Records a formal shift handover sign-off / acknowledgment by an incoming team member.
 */
export async function acknowledgeShiftHandover(
  workspaceId: string,
  channelId: string,
  messageId: string,
  shiftPeriod: string,
  handoverAuthorId?: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const userProfile = await prisma.user.findUnique({
      where: { id: access.user.id },
      select: { fullName: true, email: true },
    });
    const signerName = userProfile?.fullName || access.user.email || "Team Member";

    const ack = await prisma.chatHandoverAcknowledgment.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: access.user.id,
        },
      },
      update: {
        shiftPeriod: shiftPeriod || "Shift Handover",
        userName: signerName,
      },
      create: {
        workspaceId: access.workspace.id,
        channelId,
        messageId,
        shiftPeriod: shiftPeriod || "Shift Handover",
        userId: access.user.id,
        userName: signerName,
      },
    });

    // Notify original handover author if different from acknowledger
    if (handoverAuthorId && handoverAuthorId !== access.user.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: handoverAuthorId,
            workspaceId: access.workspace.id,
            type: "SHIFT_HANDOVER",
            title: `Shift Handover Acknowledged`,
            message: `${signerName} acknowledged your ${shiftPeriod || "Shift Handover"} report.`,
            link: "/chat",
            metadata: {
              channelId,
              messageId,
              acknowledgedBy: signerName,
              acknowledgedAt: ack.createdAt.toISOString(),
            },
          },
        });
      } catch (notifErr) {
        console.warn("[Shift Handover] Failed to dispatch acknowledgment notification:", notifErr);
      }
    }

    revalidatePath("/chat");

    return {
      success: true,
      error: null,
      acknowledgment: {
        id: ack.id,
        messageId: ack.messageId,
        shiftPeriod: ack.shiftPeriod,
        userId: ack.userId,
        userName: ack.userName,
        createdAt: ack.createdAt.toISOString(),
        timestamp: ack.createdAt.getTime(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to record handover acknowledgment.",
    };
  }
}

/**
 * Dispatches an in-app notification when a new structured shift handover report is published.
 */
export async function notifyNewShiftHandover(
  workspaceId: string,
  channelId: string,
  channelName: string,
  shiftPeriod: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    // Get all channel members
    const members = await prisma.chatChannelMember.findMany({
      where: { channelId },
      select: { userId: true },
    });

    const targetUserIds = members
      .map((m) => m.userId)
      .filter((uid) => uid !== access.user.id);

    if (targetUserIds.length === 0) return { success: true };

    const authorProfile = await prisma.user.findUnique({
      where: { id: access.user.id },
      select: { fullName: true },
    });
    const authorName = authorProfile?.fullName || access.user.email;

    await prisma.notification.createMany({
      data: targetUserIds.map((uid) => ({
        userId: uid,
        workspaceId: access.workspace.id,
        type: "SHIFT_HANDOVER",
        title: `New Shift Handover: ${shiftPeriod}`,
        message: `${authorName} posted a shift handover report in #${channelName}.`,
        link: "/chat",
        metadata: { channelId, channelName, shiftPeriod },
      })),
    });

    return { success: true };
  } catch (err: any) {
    console.warn("[Shift Handover] Failed to broadcast new handover notifications:", err);
    return { success: false, error: err.message };
  }
}
