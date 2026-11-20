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
  roomCode: string | null;
  createdById: string;
  creatorName: string;
  createdAt: string;
}

export interface WorkspaceMeetingLinkItem {
  id: string;
  workspaceId: string;
  title: string;
  roomCode: string;
  createdById: string;
  creatorName: string;
  isInstant: boolean;
  createdAt: string;
}

export interface WorkspaceCallLogItem {
  id: string;
  workspaceId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  receiverId: string | null;
  receiverName: string | null;
  receiverAvatar: string | null;
  roomCode: string;
  type: "VOICE" | "VIDEO";
  status: "COMPLETED" | "MISSED" | "REJECTED";
  duration: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

/**
 * Generate a friendly random room code: e.g. "spk-842a-9f1b"
 */
function generateRoomCode(prefix = "spk"): string {
  const seg1 = Math.random().toString(36).substring(2, 6);
  const seg2 = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${seg1}-${seg2}`;
}

// ==========================================
// 1. SCHEDULED MEETINGS
// ==========================================

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
      roomCode: m.roomCode || `spk-${m.id.substring(0, 8)}`,
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
  roomCode?: string;
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
    const roomCode = params.roomCode?.trim() || generateRoomCode();

    const created = await prisma.scheduledMeeting.create({
      data: {
        workspaceId: access.workspace.id,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        startTime: startObj,
        endTime: endObj && !isNaN(endObj.getTime()) ? endObj : null,
        roomCode,
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
      })}. Room code: ${created.roomCode}`,
      link: `/meet?room=${created.roomCode}`,
      metadata: {
        meetingId: created.id,
        workspaceId: access.workspace.id,
        startTime: created.startTime.toISOString(),
        roomCode: created.roomCode,
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
        roomCode: created.roomCode,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to schedule meeting" };
  }
}

export async function cancelWorkspaceMeeting(
  workspaceId: string,
  meetingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const existing = await prisma.scheduledMeeting.findUnique({
      where: { id: meetingId },
    });

    if (!existing || existing.workspaceId !== access.workspace.id) {
      return { success: false, error: "Meeting not found." };
    }

    await prisma.scheduledMeeting.delete({
      where: { id: meetingId },
    });

    revalidatePath("/meet");
    revalidatePath("/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to cancel meeting" };
  }
}

// ==========================================
// 2. WORKSPACE MEETING LINKS & INSTANT ROOMS
// ==========================================

export async function getWorkspaceMeetingLinks(
  workspaceId: string
): Promise<{ success: boolean; links: WorkspaceMeetingLinkItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, links: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const rows = await prisma.workspaceMeetingLink.findMany({
      where: { workspaceId: access.workspace.id },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const links: WorkspaceMeetingLinkItem[] = rows.map((l) => ({
      id: l.id,
      workspaceId: l.workspaceId,
      title: l.title,
      roomCode: l.roomCode,
      createdById: l.createdById,
      creatorName: l.creator.fullName,
      isInstant: l.isInstant,
      createdAt: l.createdAt.toISOString(),
    }));

    return { success: true, links };
  } catch (err: any) {
    return { success: false, links: [], error: err?.message || "Failed to load meeting links" };
  }
}

export async function createWorkspaceMeetingLink(params: {
  workspaceId: string;
  title: string;
  roomCode?: string;
  isInstant?: boolean;
}): Promise<{ success: boolean; link?: WorkspaceMeetingLinkItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    const title = params.title?.trim() || "Quick Meeting Room";
    const roomCode = params.roomCode?.trim() || generateRoomCode(params.isInstant ? "inst" : "spk");

    const created = await prisma.workspaceMeetingLink.create({
      data: {
        workspaceId: access.workspace.id,
        title,
        roomCode,
        createdById: access.user.id,
        isInstant: params.isInstant ?? false,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });

    revalidatePath("/meet");

    return {
      success: true,
      link: {
        id: created.id,
        workspaceId: created.workspaceId,
        title: created.title,
        roomCode: created.roomCode,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        isInstant: created.isInstant,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create meeting link" };
  }
}

export async function deleteWorkspaceMeetingLink(
  workspaceId: string,
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const existing = await prisma.workspaceMeetingLink.findUnique({
      where: { id: linkId },
    });

    if (!existing || existing.workspaceId !== access.workspace.id) {
      return { success: false, error: "Link not found." };
    }

    await prisma.workspaceMeetingLink.delete({
      where: { id: linkId },
    });

    revalidatePath("/meet");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete meeting link" };
  }
}

// ==========================================
// 3. WORKSPACE CALL LOGS & 1-ON-1 CALLS
// ==========================================

export async function getWorkspaceCallLogs(
  workspaceId: string
): Promise<{ success: boolean; callLogs: WorkspaceCallLogItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, callLogs: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const rows = await prisma.workspaceCallLog.findMany({
      where: { workspaceId: access.workspace.id },
      include: {
        caller: { select: { id: true, fullName: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    const callLogs: WorkspaceCallLogItem[] = rows.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      callerId: c.callerId,
      callerName: c.caller.fullName,
      callerAvatar: c.caller.avatarUrl,
      receiverId: c.receiverId,
      receiverName: c.receiver?.fullName || "Team Member",
      receiverAvatar: c.receiver?.avatarUrl || null,
      roomCode: c.roomCode,
      type: (c.type as "VOICE" | "VIDEO") || "VIDEO",
      status: (c.status as "COMPLETED" | "MISSED" | "REJECTED") || "COMPLETED",
      duration: c.duration,
      startedAt: c.startedAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    }));

    return { success: true, callLogs };
  } catch (err: any) {
    return { success: false, callLogs: [], error: err?.message || "Failed to load call logs" };
  }
}

export async function recordWorkspaceCallLog(params: {
  workspaceId: string;
  receiverId?: string;
  roomCode: string;
  type: "VOICE" | "VIDEO";
  status: "COMPLETED" | "MISSED" | "REJECTED";
  duration: number;
}): Promise<{ success: boolean; callLog?: WorkspaceCallLogItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - Math.max(params.duration, 0) * 1000);

    const created = await prisma.workspaceCallLog.create({
      data: {
        workspaceId: access.workspace.id,
        callerId: access.user.id,
        receiverId: params.receiverId || null,
        roomCode: params.roomCode,
        type: params.type,
        status: params.status,
        duration: Math.max(0, Math.round(params.duration)),
        startedAt,
        endedAt,
      },
      include: {
        caller: { select: { id: true, fullName: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    revalidatePath("/meet");

    return {
      success: true,
      callLog: {
        id: created.id,
        workspaceId: created.workspaceId,
        callerId: created.callerId,
        callerName: created.caller.fullName,
        callerAvatar: created.caller.avatarUrl,
        receiverId: created.receiverId,
        receiverName: created.receiver?.fullName || null,
        receiverAvatar: created.receiver?.avatarUrl || null,
        roomCode: created.roomCode,
        type: (created.type as "VOICE" | "VIDEO") || "VIDEO",
        status: (created.status as "COMPLETED" | "MISSED" | "REJECTED") || "COMPLETED",
        duration: created.duration,
        startedAt: created.startedAt.toISOString(),
        endedAt: created.endedAt ? created.endedAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to record call log" };
  }
}
