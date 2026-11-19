"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { notifyWorkspaceMembers } from "@/lib/actions/notifications";

export interface ScheduledMeetingItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  createdById: string;
  creatorName: string;
  createdAt: string;
}

export async function getWorkspaceMeetings(
  workspaceId: string
): Promise<{ success: boolean; meetings: ScheduledMeetingItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, meetings: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const rows = await prisma.scheduledMeeting.findMany({
      where: {
        workspaceId: access.workspace.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const meetings: ScheduledMeetingItem[] = rows.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      title: m.title,
      description: m.description,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime ? m.endTime.toISOString() : null,
      createdById: m.createdById,
      creatorName: m.creator.fullName,
      createdAt: m.createdAt.toISOString(),
    }));

    return { success: true, meetings };
  } catch (err: any) {
    return { success: false, meetings: [], error: err?.message || "Failed to load meetings" };
  }
}

export async function scheduleWorkspaceMeeting(params: {
  workspaceId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
}): Promise<{ success: boolean; meeting?: ScheduledMeetingItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    if (!params.title || !params.title.trim()) {
      return { success: false, error: "Meeting title is required." };
    }

    const startObj = new Date(params.startTime);
    if (isNaN(startObj.getTime())) {
      return { success: false, error: "Valid meeting start time is required." };
    }

    const endObj = params.endTime ? new Date(params.endTime) : null;

    const created = await prisma.scheduledMeeting.create({
      data: {
        workspaceId: access.workspace.id,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        startTime: startObj,
        endTime: endObj && !isNaN(endObj.getTime()) ? endObj : null,
        createdById: access.user.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });

    // Notify all active workspace members about the scheduled meeting
    await notifyWorkspaceMembers({
      workspaceId: access.workspace.id,
      excludeUserId: access.user.id,
      type: "MEETING_SCHEDULED",
      title: `Meeting Scheduled: "${created.title}"`,
      message: `${created.creator.fullName} scheduled a meeting for ${startObj.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      link: "/meet",
      metadata: {
        meetingId: created.id,
        workspaceId: access.workspace.id,
        startTime: created.startTime.toISOString(),
      },
    });

    revalidatePath("/meet");
    revalidatePath("/calendar");

    return {
      success: true,
      meeting: {
        id: created.id,
        workspaceId: created.workspaceId,
        title: created.title,
        description: created.description,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime ? created.endTime.toISOString() : null,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to schedule meeting" };
  }
}
