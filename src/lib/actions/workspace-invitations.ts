"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { canInviteMembers } from "@/lib/permissions";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations/workspace";
import { sendWorkspaceInvitationEmail } from "@/lib/email";
import { WorkspaceRole, WorkspaceInvitationItem } from "@/lib/types";

/**
 * Generates a SHA-256 hex hash of a raw token string.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates and dispatches an invitation to join the workspace.
 */
export async function inviteWorkspaceMember(
  workspaceId: string,
  input: InviteMemberInput
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    // Verify invitation permissions
    if (!canInviteMembers(access.member.role, access.settings)) {
      return {
        success: false,
        error: "You do not have permission to invite members to this workspace.",
      };
    }

    const validation = inviteMemberSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid invitation data.",
      };
    }

    const { email, role } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if target is already an active member of this workspace
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.workspace.id,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      return {
        success: false,
        error: `User with email ${normalizedEmail} is already a member of this workspace.`,
      };
    }

    // Check if there is an active pending invitation
    const existingInvite = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId: access.workspace.id,
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return {
        success: false,
        error: `An active pending invitation for ${normalizedEmail} already exists.`,
      };
    }

    // Generate 32-byte cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: access.workspace.id,
        email: normalizedEmail,
        role: role as WorkspaceRole,
        tokenHash,
        invitedBy: access.user.id,
        expiresAt,
      },
      include: {
        inviter: { select: { fullName: true } },
      },
    });

    // Build acceptance URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const acceptUrl = `${appUrl}/invitations/accept?token=${rawToken}`;

    // Dispatch email
    const emailResult = await sendWorkspaceInvitationEmail({
      email: normalizedEmail,
      workspaceName: access.workspace.name,
      inviterName: invitation.inviter?.fullName || "A team member",
      role,
      acceptUrl,
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/members`);
    revalidatePath(`/workspaces/${access.workspace.slug}/invitations`);

    // Create real notification for target user if they already have an account
    try {
      const targetUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (targetUser) {
        await prisma.notification.create({
          data: {
            userId: targetUser.id,
            workspaceId: access.workspace.id,
            type: "WORKSPACE_INVITATION",
            title: "Workspace Invitation",
            message: `${invitation.inviter?.fullName || "A team admin"} invited you to join ${access.workspace.name} as ${role}.`,
            link: `/invitations/accept?token=${rawToken}`,
            metadata: {
              invitationId: invitation.id,
              workspaceId: access.workspace.id,
              role,
            },
          },
        });
      }
    } catch (notifErr) {
      console.warn("[Invitations] Failed to write invitation notification:", notifErr);
    }

    return {
      success: true,
      error: null,
      invitationId: invitation.id,
      devLink: emailResult.devLink,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to dispatch invitation.",
    };
  }
}

/**
 * Returns all active invitations for a workspace.
 */
export async function getWorkspaceInvitations(
  workspaceId: string
): Promise<{ invitations: WorkspaceInvitationItem[]; error: string | null }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const list = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: access.workspace.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const invitations: WorkspaceInvitationItem[] = list.map((i) => ({
      id: i.id,
      workspaceId: i.workspaceId,
      email: i.email,
      role: i.role as WorkspaceRole,
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt.toISOString(),
      acceptedAt: i.acceptedAt?.toISOString() || null,
      revokedAt: i.revokedAt?.toISOString() || null,
      createdAt: i.createdAt.toISOString(),
      inviter: i.inviter
        ? {
            id: i.inviter.id,
            email: i.inviter.email,
            fullName: i.inviter.fullName,
          }
        : undefined,
    }));

    return { invitations, error: null };
  } catch (err: any) {
    return { invitations: [], error: err.message || "Failed to load invitations." };
  }
}

/**
 * Revokes a pending invitation.
 */
export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const invite = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invite || invite.workspaceId !== access.workspace.id) {
      return { success: false, error: "Invitation not found in this workspace." };
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/invitations`);
    revalidatePath(`/workspaces/${access.workspace.slug}/members`);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to revoke invitation." };
  }
}

/**
 * Resends a pending invitation with a freshly rotated token and extended expiration.
 */
export async function resendWorkspaceInvitation(
  workspaceId: string,
  invitationId: string
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const invite = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: {
        inviter: { select: { fullName: true } },
      },
    });

    if (!invite || invite.workspaceId !== access.workspace.id) {
      return { success: false, error: "Invitation not found in this workspace." };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        expiresAt,
        revokedAt: null,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const acceptUrl = `${appUrl}/invitations/accept?token=${rawToken}`;

    const emailResult = await sendWorkspaceInvitationEmail({
      email: invite.email,
      workspaceName: access.workspace.name,
      inviterName: invite.inviter?.fullName || "A team member",
      role: invite.role,
      acceptUrl,
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/invitations`);

    return { success: true, error: null, devLink: emailResult.devLink };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resend invitation." };
  }
}

/**
 * Retrieves invitation metadata for the acceptance page.
 */
export async function getInvitationDetails(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string") {
    return { success: false, error: "Invalid invitation token." };
  }

  const tokenHash = hashToken(rawToken);
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
    include: {
      workspace: { select: { id: true, name: true, slug: true, avatarUrl: true } },
      inviter: { select: { fullName: true, email: true } },
    },
  });

  if (!invite) {
    return { success: false, error: "Invitation not found or invalid token." };
  }

  const isExpired = new Date() > invite.expiresAt;
  const isAccepted = Boolean(invite.acceptedAt);
  const isRevoked = Boolean(invite.revokedAt);

  return {
    success: true,
    invitation: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      isExpired,
      isAccepted,
      isRevoked,
      isValid: !isExpired && !isAccepted && !isRevoked,
      workspace: invite.workspace,
      inviter: invite.inviter,
    },
  };
}

/**
 * Accepts an invitation.
 * Requires authenticated user with email matching the invitation.
 */
export async function acceptWorkspaceInvitation(rawToken: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      success: false,
      error: "Please sign in or create an account to accept this invitation.",
      requiresAuth: true,
    };
  }

  const tokenHash = hashToken(rawToken);
  const invite = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
    include: {
      workspace: true,
    },
  });

  if (!invite) {
    return { success: false, error: "Invitation not found or invalid." };
  }

  if (invite.acceptedAt) {
    return { success: false, error: "This invitation has already been accepted." };
  }

  if (invite.revokedAt) {
    return { success: false, error: "This invitation has been revoked by the workspace administrator." };
  }

  if (new Date() > invite.expiresAt) {
    return { success: false, error: "This invitation has expired. Please request a new invitation." };
  }

  // Security: Verify authenticated user's email matches the invitation target email
  const userEmail = user.email.toLowerCase().trim();
  const inviteEmail = invite.email.toLowerCase().trim();

  if (userEmail !== inviteEmail) {
    return {
      success: false,
      error: `This invitation was issued to ${invite.email}. You are currently signed in as ${user.email}. Please sign in with the invited email address.`,
    };
  }

  try {
    // Transactionally create membership and mark invitation as accepted
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          status: "ACTIVE",
        },
        update: {
          role: invite.role,
          status: "ACTIVE",
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      // Mark the invitation notification as read
      await tx.notification.updateMany({
        where: {
          userId: user.id,
          workspaceId: invite.workspaceId,
          type: "WORKSPACE_INVITATION",
        },
        data: { isRead: true },
      });

      // Notify the inviter that the user has joined
      await tx.notification.create({
        data: {
          userId: invite.invitedBy,
          workspaceId: invite.workspaceId,
          type: "MEMBER_JOINED",
          title: "New Team Member",
          message: `${user.user_metadata?.full_name || user.email} joined ${invite.workspace.name}.`,
          link: "/teams",
          metadata: {
            memberUserId: user.id,
            workspaceId: invite.workspaceId,
          },
        },
      });
    });

    revalidatePath("/workspaces");
    revalidatePath(`/workspaces/${invite.workspace.slug}`);

    return {
      success: true,
      error: null,
      workspaceSlug: invite.workspace.slug,
      workspaceName: invite.workspace.name,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to accept invitation.",
    };
  }
}

