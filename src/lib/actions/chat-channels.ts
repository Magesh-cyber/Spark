"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import { syncNexconnGroupChannel } from "@/lib/nexconn/server";
import { z } from "zod";

export interface ChatChannelItem {
  id: string;
  workspaceId: string;
  nexconnChannelId: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "PRIVATE";
  isDefault: boolean;
  createdById: string;
  createdAt: string;
  unreadCount?: number;
}

const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Channel name must be at least 2 characters.")
    .max(50, "Channel name cannot exceed 50 characters.")
    .regex(/^[a-z0-9-]+$/, "Channel name can only contain lowercase letters, numbers, and hyphens."),
  description: z.string().trim().max(200).optional(),
  type: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  memberIds: z.array(z.string().uuid()).optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/**
 * Returns all channels in a workspace accessible to the caller.
 */
export async function getWorkspaceChannels(workspaceId: string): Promise<{
  channels: ChatChannelItem[];
  error: string | null;
}> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { channels: [], error: null };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const channels = await prisma.workspaceChatChannel.findMany({
      where: {
        workspaceId: access.workspace.id,
        OR: [
          { type: "PUBLIC" },
          { members: { some: { userId: access.user.id } } },
          ...(access.member.role === "OWNER" || access.member.role === "ADMIN"
            ? [{ type: "PRIVATE" as const }]
            : []),
        ],
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    const formatted: ChatChannelItem[] = channels.map((c) => ({
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

    return { channels: formatted, error: null };
  } catch (err: any) {
    return { channels: [], error: err.message || "Failed to load channels." };
  }
}

/**
 * Creates a new public or private channel in the workspace.
 */
export async function createWorkspaceChannel(
  workspaceId: string,
  input: CreateChannelInput
) {
  try {
    // MANAGER, ADMIN, or OWNER can create channels
    const access = await verifyWorkspaceAccess(workspaceId, "MANAGER");

    const validation = createChannelSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid channel parameters.",
        channel: null,
      };
    }

    const { name, description, type, memberIds = [] } = validation.data;

    // Check for duplicate name in this workspace
    const existing = await prisma.workspaceChatChannel.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: access.workspace.id,
          name,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Channel '#${name}' already exists in this workspace.`,
        channel: null,
      };
    }

    // Generate unique, deterministic Nexconn channel ID
    const shortWsId = access.workspace.id.replace(/-/g, "").substring(0, 8);
    const nexconnChannelId = `spark_chan_${shortWsId}_${name}`;

    // Ensure creator is included in private channels
    const initialMemberIds = Array.from(new Set([access.user.id, ...memberIds]));

    const channel = await prisma.workspaceChatChannel.create({
      data: {
        workspaceId: access.workspace.id,
        nexconnChannelId,
        name,
        description: description || null,
        type,
        isDefault: false,
        createdById: access.user.id,
        ...(type === "PRIVATE"
          ? {
              members: {
                create: initialMemberIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
    });

    // Synchronize Nexconn Group membership
    try {
      if (type === "PUBLIC") {
        const allMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: access.workspace.id, status: "ACTIVE" },
          select: { userId: true },
        });
        await syncNexconnGroupChannel(
          nexconnChannelId,
          name,
          allMembers.map((m) => m.userId)
        );
      } else {
        await syncNexconnGroupChannel(nexconnChannelId, name, initialMemberIds);
      }
    } catch {
      // Non-blocking sync
    }

    // Notify other workspace members about the new channel
    try {
      const targetUserIds = type === "PUBLIC"
        ? (
            await prisma.workspaceMember.findMany({
              where: {
                workspaceId: access.workspace.id,
                status: "ACTIVE",
                userId: { not: access.user.id },
              },
              select: { userId: true },
            })
          ).map((m) => m.userId)
        : initialMemberIds.filter((uid) => uid !== access.user.id);

      if (targetUserIds.length > 0) {
        const creatorProfile = await prisma.user.findUnique({
          where: { id: access.user.id },
          select: { fullName: true },
        });
        const creatorName = creatorProfile?.fullName || access.user.email;

        await prisma.notification.createMany({
          data: targetUserIds.map((uid) => ({
            userId: uid,
            workspaceId: access.workspace.id,
            type: "CHAT_CHANNEL",
            title: `#${name} channel created`,
            message: `${creatorName} created new channel #${name} in ${access.workspace.name}.`,
            link: "/chat",
            metadata: { channelId: channel.id, channelName: name, workspaceId: access.workspace.id },
          })),
        });
      }
    } catch (notifErr) {
      console.warn("[Channels] Failed to write channel creation notifications:", notifErr);
    }

    revalidatePath("/chat");

    return {
      success: true,
      error: null,
      channel: {
        id: channel.id,
        workspaceId: channel.workspaceId,
        nexconnChannelId: channel.nexconnChannelId,
        name: channel.name,
        description: channel.description,
        type: channel.type as "PUBLIC" | "PRIVATE",
        isDefault: channel.isDefault,
        createdById: channel.createdById,
        createdAt: channel.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create channel.",
      channel: null,
    };
  }
}

/**
 * Returns complete details for a channel, including members and pinned artifacts.
 */
export async function getChannelDetails(workspaceId: string, channelId: string) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
      include: {
        creator: { select: { id: true, fullName: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
          },
        },
        pinnedArtifacts: {
          include: {
            pinnedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!channel || channel.workspaceId !== access.workspace.id) {
      return { channel: null, error: "Channel not found in this workspace." };
    }

    // Verify access if private
    if (channel.type === "PRIVATE") {
      const isMember = channel.members.some((m) => m.userId === access.user.id);
      const isPrivileged = access.member.role === "OWNER" || access.member.role === "ADMIN";
      if (!isMember && !isPrivileged) {
        return { channel: null, error: "Access denied to private channel." };
      }
    }

    return {
      channel: {
        id: channel.id,
        workspaceId: channel.workspaceId,
        nexconnChannelId: channel.nexconnChannelId,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        isDefault: channel.isDefault,
        creator: channel.creator,
        members: channel.members.map((m) => m.user),
        pinnedArtifacts: channel.pinnedArtifacts.map((p) => ({
          id: p.id,
          title: p.title,
          url: p.url,
          pinnedBy: p.pinnedBy.fullName,
          createdAt: p.createdAt.toISOString(),
        })),
        createdAt: channel.createdAt.toISOString(),
      },
      error: null,
    };
  } catch (err: any) {
    return { channel: null, error: err.message || "Failed to load channel details." };
  }
}

/**
 * Pins a link or document to a channel.
 */
export async function pinArtifactToChannel(
  workspaceId: string,
  channelId: string,
  input: { title: string; url: string }
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.workspaceId !== access.workspace.id) {
      return { success: false, error: "Channel not found." };
    }

    const pinned = await prisma.chatPinnedArtifact.create({
      data: {
        channelId,
        title: input.title.trim(),
        url: input.url.trim(),
        pinnedById: access.user.id,
      },
    });

    revalidatePath("/chat");
    return { success: true, pinnedId: pinned.id, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to pin artifact." };
  }
}

/**
 * Deletes a channel (only for ADMIN or OWNER; default #general channel cannot be deleted).
 */
export async function deleteWorkspaceChannel(workspaceId: string, channelId: string) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const channel = await prisma.workspaceChatChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.workspaceId !== access.workspace.id) {
      return { success: false, error: "Channel not found." };
    }

    if (channel.isDefault) {
      return { success: false, error: "The default #general channel cannot be deleted." };
    }

    await prisma.workspaceChatChannel.delete({
      where: { id: channelId },
    });

    revalidatePath("/chat");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete channel." };
  }
}

