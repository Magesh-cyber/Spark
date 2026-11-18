"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { canManageMembers, canChangeMemberRoles } from "@/lib/permissions";
import { WorkspaceRole, MembershipStatus, WorkspaceMemberItem } from "@/lib/types";

/**
 * Returns the member directory for a workspace.
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<{ members: WorkspaceMemberItem[]; error: string | null }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { members: [], error: null };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: access.workspace.id },
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
      orderBy: [
        { role: "asc" },
        { joinedAt: "asc" },
      ],
    });

    const formatted: WorkspaceMemberItem[] = members.map((m) => ({
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

    return { members: formatted, error: null };
  } catch (err: any) {
    return { members: [], error: err.message || "Failed to load members." };
  }
}

/**
 * Changes a member's role within the workspace.
 */
export async function updateMemberRole(
  workspaceId: string,
  targetMemberId: string,
  newRole: WorkspaceRole
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const target = await prisma.workspaceMember.findUnique({
      where: { id: targetMemberId },
    });

    if (!target || target.workspaceId !== access.workspace.id) {
      return { success: false, error: "Member record not found in this workspace." };
    }

    // Check RBAC permissions
    if (
      !canChangeMemberRoles(
        access.member.role,
        target.role as WorkspaceRole,
        newRole
      )
    ) {
      return {
        success: false,
        error: "Insufficient permissions to change this member's role.",
      };
    }

    // Protect last active owner
    if (target.role === "OWNER" && newRole !== "OWNER") {
      const activeOwners = await prisma.workspaceMember.count({
        where: {
          workspaceId: access.workspace.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      if (activeOwners <= 1) {
        return {
          success: false,
          error: "Cannot change role of the last active Owner. Transfer ownership first.",
        };
      }
    }

    await prisma.workspaceMember.update({
      where: { id: targetMemberId },
      data: { role: newRole },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/members`);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update member role." };
  }
}

/**
 * Suspends or reactivates a member's access.
 */
export async function updateMemberStatus(
  workspaceId: string,
  targetMemberId: string,
  newStatus: MembershipStatus
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const target = await prisma.workspaceMember.findUnique({
      where: { id: targetMemberId },
    });

    if (!target || target.workspaceId !== access.workspace.id) {
      return { success: false, error: "Member record not found in this workspace." };
    }

    // Check RBAC permissions
    if (!canManageMembers(access.member.role, target.role as WorkspaceRole)) {
      return {
        success: false,
        error: "Insufficient permissions to alter this member's status.",
      };
    }

    // Protect last active owner
    if (target.role === "OWNER" && newStatus === "SUSPENDED") {
      return {
        success: false,
        error: "Cannot suspend workspace Owner.",
      };
    }

    await prisma.workspaceMember.update({
      where: { id: targetMemberId },
      data: { status: newStatus },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/members`);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update member status." };
  }
}

/**
 * Removes a member from the workspace (or allows self-leave).
 */
export async function removeMember(
  workspaceId: string,
  targetMemberId: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const target = await prisma.workspaceMember.findUnique({
      where: { id: targetMemberId },
    });

    if (!target || target.workspaceId !== access.workspace.id) {
      return { success: false, error: "Member record not found in this workspace." };
    }

    const isSelfRemoval = target.userId === access.user.id;

    // Check permissions if not self-leave
    if (!isSelfRemoval) {
      if (!canManageMembers(access.member.role, target.role as WorkspaceRole)) {
        return {
          success: false,
          error: "Insufficient permissions to remove this member.",
        };
      }
    }

    // Protect last active owner
    if (target.role === "OWNER") {
      const activeOwners = await prisma.workspaceMember.count({
        where: {
          workspaceId: access.workspace.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      if (activeOwners <= 1) {
        return {
          success: false,
          error: "The last active Owner cannot leave or be removed from the workspace. Transfer ownership first.",
        };
      }
    }

    // Personal workspace protection
    if (access.workspace.type === "PERSONAL" && target.userId === access.workspace.ownerId) {
      return {
        success: false,
        error: "Personal workspace owner cannot be removed.",
      };
    }

    // Clean up channel memberships in this workspace
    await prisma.chatChannelMember.deleteMany({
      where: {
        userId: target.userId,
        channel: { workspaceId: access.workspace.id },
      },
    });

    await prisma.workspaceMember.delete({
      where: { id: targetMemberId },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/members`);
    revalidatePath("/workspaces");

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove member." };
  }
}

