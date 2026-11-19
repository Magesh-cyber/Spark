"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateWorkspaceSettingsSchema,
  transferOwnershipSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type UpdateWorkspaceSettingsInput,
  type TransferOwnershipInput,
} from "@/lib/validations/workspace";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import {
  canManageSettings,
  canDeleteWorkspace,
  canTransferOwnership,
} from "@/lib/permissions";
import { Workspace, WorkspaceRole, WorkspaceType, WorkspaceJoinRequestItem } from "@/lib/types";
import { generateJoinCode } from "@/lib/utils/join-code";
import { syncNexconnGroupChannel } from "@/lib/nexconn/server";

/**
 * Ensures that the authenticated user possesses a Personal Workspace.
 * Idempotent, duplicate-safe, and transactional.
 */
export async function ensurePersonalWorkspace(
  userId: string,
  userEmail: string,
  fullName: string
): Promise<Workspace> {
  // Check if personal workspace already exists
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: userId, type: "PERSONAL" },
    include: {
      settings: true,
      members: { where: { userId } },
    },
  });

  if (existing) {
    // Self-heal member row if missing
    if (existing.members.length === 0) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: existing.id,
          userId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
    }

    return {
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      type: "personal",
      role: "OWNER",
      description: existing.description,
      avatarUrl: existing.avatarUrl,
      joinCode: existing.joinCode,
      isPrivate: existing.isPrivate,
      ownerId: existing.ownerId,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create personal workspace inside transaction
  const firstName = fullName.trim().split(" ")[0] || "Personal";
  const baseSlug = `personal-${userId.substring(0, 8)}`;
  const personalJoinCode = generateJoinCode();
  const generalChannelJoinCode = generateJoinCode();

  try {
    const created = await prisma.workspace.create({
      data: {
        name: `${firstName}'s Personal Workspace`,
        slug: baseSlug,
        type: "PERSONAL",
        description: "Your private workspace for personal tasks, notes, and projects.",
        ownerId: userId,
        joinCode: personalJoinCode,
        isPrivate: true,
        members: {
          create: {
            userId,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
        settings: {
          create: {
            defaultMemberRole: "MEMBER",
            allowMemberInvitations: false,
            allowGuestAccess: false,
          },
        },
        channels: {
          create: {
            name: "general",
            description: "Personal notes and ideas",
            type: "PUBLIC",
            isDefault: true,
            joinCode: generalChannelJoinCode,
            nexconnChannelId: `spark_chan_${baseSlug.substring(0, 8)}_${Date.now()}_general`,
            createdById: userId,
          },
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      type: "personal",
      role: "OWNER",
      description: created.description,
      avatarUrl: created.avatarUrl,
      joinCode: created.joinCode,
      isPrivate: created.isPrivate,
      ownerId: created.ownerId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  } catch {
    // If concurrent request won race, fetch existing
    const fallback = await prisma.workspace.findFirst({
      where: { ownerId: userId, type: "PERSONAL" },
    });
    if (fallback) {
      return {
        id: fallback.id,
        name: fallback.name,
        slug: fallback.slug,
        type: "personal",
        role: "OWNER",
        description: fallback.description,
        avatarUrl: fallback.avatarUrl,
        ownerId: fallback.ownerId,
      };
    }
    throw new Error("Failed to initialize personal workspace.");
  }
}

/**
 * Returns all workspaces the authenticated user belongs to.
 */
export async function getUserWorkspaces(): Promise<{
  workspaces: Workspace[];
  error: string | null;
}> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { workspaces: [], error: "Unauthenticated" };
  }

  try {
    // 1. Fetch all active memberships for user first (fast path)
    let memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: user.id,
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
      orderBy: {
        joinedAt: "asc",
      },
    });

    // 2. Only ensure personal workspace if user has none
    const hasPersonalWorkspace = memberships.some(
      (m) => m.workspace.type === "PERSONAL"
    );

    if (!hasPersonalWorkspace) {
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "SPARK User";

      await ensurePersonalWorkspace(user.id, user.email || "", fullName);

      // Re-fetch memberships now that personal workspace is created
      memberships = await prisma.workspaceMember.findMany({
        where: {
          userId: user.id,
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
        orderBy: {
          joinedAt: "asc",
        },
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
      joinCode: m.workspace.joinCode,
      isPrivate: m.workspace.isPrivate,
      memberCount: m.workspace._count.members,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
    }));

    return { workspaces, error: null };
  } catch (err: any) {
    console.error("Error loading user workspaces:", err);
    return { workspaces: [], error: err.message || "Failed to load workspaces." };
  }
}

/**
 * Fetches single workspace details by slug with authorization check.
 */
export async function getWorkspaceBySlug(slug: string) {
  try {
    const access = await verifyWorkspaceAccess(slug);
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId: access.workspace.id, status: "ACTIVE" },
    });

    return {
      success: true,
      workspace: {
        ...access.workspace,
        memberCount,
      },
      callerRole: access.member.role,
      settings: access.settings,
      error: null,
    };
  } catch (err: any) {
    return {
      success: false,
      workspace: null,
      callerRole: null,
      settings: null,
      error: err.message || "Failed to access workspace.",
    };
  }
}

/**
 * Creates a new organization workspace.
 */
export async function createOrganizationWorkspace(input: CreateWorkspaceInput) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { success: false, error: "Unauthenticated", workspace: null };
  }

  const validation = createWorkspaceSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid workspace data.",
      workspace: null,
    };
  }

  const { name, slug, description, avatarUrl, isPrivate = false } = validation.data;

  // Check if slug is already taken
  const existingSlug = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (existingSlug) {
    return {
      success: false,
      error: `Workspace slug '${slug}' is already taken. Please choose another unique URL slug.`,
      workspace: null,
    };
  }

  // Generate unique 6-character workspace join code
  let workspaceJoinCode = generateJoinCode();
  let isWsCodeUnique = false;
  while (!isWsCodeUnique) {
    const existingCode = await prisma.workspace.findUnique({ where: { joinCode: workspaceJoinCode } });
    if (!existingCode) isWsCodeUnique = true;
    else workspaceJoinCode = generateJoinCode();
  }

  // Generate unique 6-character general channel join code
  let channelJoinCode = generateJoinCode();
  let isChCodeUnique = false;
  while (!isChCodeUnique) {
    const existingChCode = await prisma.workspaceChatChannel.findUnique({ where: { joinCode: channelJoinCode } });
    if (!existingChCode) isChCodeUnique = true;
    else channelJoinCode = generateJoinCode();
  }

  try {
    // Transactionally create organization workspace, owner membership, and settings
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          description: description || null,
          type: "ORGANIZATION",
          avatarUrl: avatarUrl || null,
          joinCode: workspaceJoinCode,
          isPrivate: Boolean(isPrivate),
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
          settings: {
            create: {
              defaultMemberRole: "MEMBER",
              allowMemberInvitations: true,
              allowGuestAccess: false,
            },
          },
          channels: {
            create: {
              name: "general",
              description: "General workspace announcements and open team discussions",
              type: "PUBLIC",
              isDefault: true,
              joinCode: channelJoinCode,
              nexconnChannelId: `spark_chan_${slug.substring(0, 8)}_${Date.now()}_general`,
              createdById: user.id,
            },
          },
        },
      });

      return created;
    });

    revalidatePath("/workspaces");
    revalidatePath("/");

    return {
      success: true,
      error: null,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: "organization" as const,
        role: "OWNER" as const,
        joinCode: workspace.joinCode,
        isPrivate: workspace.isPrivate,
      },
    };
  } catch (err: any) {
    console.error("Failed to create workspace:", err);
    return {
      success: false,
      error: err.message || "Failed to create workspace.",
      workspace: null,
    };
  }
}

/**
 * Updates organization workspace details.
 * Requires OWNER or ADMIN role.
 */
export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");
    const validation = updateWorkspaceSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input data.",
      };
    }

    const { name, description, avatarUrl } = validation.data;

    await prisma.workspace.update({
      where: { id: access.workspace.id },
      data: {
        name,
        description: description || null,
        avatarUrl: avatarUrl || null,
      },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}`);
    revalidatePath(`/workspaces/${access.workspace.slug}/settings`);
    revalidatePath("/workspaces");

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update workspace.",
    };
  }
}

/**
 * Updates workspace settings.
 * Requires OWNER or ADMIN role.
 */
export async function updateWorkspaceSettings(
  workspaceId: string,
  input: UpdateWorkspaceSettingsInput
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");
    if (!canManageSettings(access.member.role)) {
      return { success: false, error: "Insufficient permissions to change settings." };
    }

    const validation = updateWorkspaceSettingsSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid settings data.",
      };
    }

    const { defaultMemberRole, allowMemberInvitations, allowGuestAccess } =
      validation.data;

    await prisma.workspaceSettings.upsert({
      where: { workspaceId: access.workspace.id },
      create: {
        workspaceId: access.workspace.id,
        defaultMemberRole,
        allowMemberInvitations,
        allowGuestAccess,
      },
      update: {
        defaultMemberRole,
        allowMemberInvitations,
        allowGuestAccess,
      },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/settings`);

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update workspace settings.",
    };
  }
}

/**
 * Deletes an organization workspace.
 * Requires OWNER role. Personal workspaces cannot be deleted.
 */
export async function deleteWorkspace(workspaceId: string) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "OWNER");

    if (!canDeleteWorkspace(access.member.role, access.workspace.type)) {
      return {
        success: false,
        error: "Personal workspaces cannot be deleted. Only organization workspaces can be deleted by their owner.",
      };
    }

    // Cascade deletion handled by foreign keys
    await prisma.workspace.delete({
      where: { id: access.workspace.id },
    });

    revalidatePath("/workspaces");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete workspace.",
    };
  }
}

/**
 * Transfers ownership of an organization workspace to an existing member.
 * Requires OWNER role.
 */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  input: TransferOwnershipInput
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "OWNER");

    if (!canTransferOwnership(access.member.role, access.workspace.type)) {
      return {
        success: false,
        error: "Ownership transfer is only permitted for organization workspaces.",
      };
    }

    const validation = transferOwnershipSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Confirmation failed.",
      };
    }

    const { newOwnerId } = validation.data;

    if (newOwnerId === access.user.id) {
      return { success: false, error: "You are already the owner of this workspace." };
    }

    // Target must be an active member of this workspace
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: access.workspace.id,
          userId: newOwnerId,
        },
      },
    });

    if (!targetMember || targetMember.status !== "ACTIVE") {
      return {
        success: false,
        error: "New owner must be an active member of this workspace.",
      };
    }

    // Transactionally transfer ownership
    await prisma.$transaction(async (tx) => {
      // 1. Promote target member to OWNER
      await tx.workspaceMember.update({
        where: { id: targetMember.id },
        data: { role: "OWNER" },
      });

      // 2. Demote current owner to ADMIN
      await tx.workspaceMember.update({
        where: { id: access.member.id },
        data: { role: "ADMIN" },
      });

      // 3. Update workspace ownerId
      await tx.workspace.update({
        where: { id: access.workspace.id },
        data: { ownerId: newOwnerId },
      });
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/settings`);
    revalidatePath(`/workspaces/${access.workspace.slug}/members`);

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to transfer workspace ownership.",
    };
  }
}

/**
 * Joins a workspace using a 6-character alphanumeric join code.
 * If the workspace is PUBLIC: immediately joins as MEMBER.
 * If the workspace is PRIVATE: creates a pending join request for owner/admin approval.
 */
export async function joinWorkspaceByCode(rawCode: string): Promise<{
  success: boolean;
  error?: string | null;
  message?: string;
  workspaceSlug?: string;
  workspaceName?: string;
  requiresApproval?: boolean;
  alreadyMember?: boolean;
}> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: "Please sign in to join a workspace." };
  }

  const code = (rawCode || "").trim().toUpperCase();
  if (!code || code.length < 4) {
    return { success: false, error: "Please enter a valid 6-character join code." };
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { joinCode: code },
      include: {
        settings: true,
        channels: { where: { type: "PUBLIC" } },
      },
    });

    if (!workspace) {
      return {
        success: false,
        error: `No workspace found with join code "${code}". Please verify the code with your workspace owner.`,
      };
    }

    // Check if user is already an active member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    if (existingMember && existingMember.status === "ACTIVE") {
      return {
        success: true,
        alreadyMember: true,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        message: `You are already an active member of ${workspace.name}.`,
      };
    }

    const callerProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, email: true },
    });
    const callerName = callerProfile?.fullName || user.email || "A user";

    // CASE 1: PUBLIC WORKSPACE -> Instant admission
    if (!workspace.isPrivate) {
      const defaultRole = workspace.settings?.defaultMemberRole || "MEMBER";

      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: defaultRole,
          status: "ACTIVE",
        },
        update: {
          role: defaultRole,
          status: "ACTIVE",
        },
      });

      // Synchronize Nexconn public channels with new member
      try {
        const publicChannels = workspace.channels;
        const allMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: workspace.id, status: "ACTIVE" },
          select: { userId: true },
        });
        for (const ch of publicChannels) {
          await syncNexconnGroupChannel(ch.nexconnChannelId, ch.name, allMembers.map((m) => m.userId));
        }
      } catch {
        // Non-blocking sync
      }

      // Notify the workspace owner that a new member joined via join code
      try {
        if (workspace.ownerId !== user.id) {
          await prisma.notification.create({
            data: {
              userId: workspace.ownerId,
              workspaceId: workspace.id,
              type: "MEMBER_JOINED",
              title: "New Member Joined",
              message: `${callerName} joined ${workspace.name} using join code ${code}.`,
              link: `/workspaces/${workspace.slug}/members`,
              metadata: {
                workspaceId: workspace.id,
                joinedUserId: user.id,
                joinCode: code,
              },
            },
          });
        }
      } catch (notifErr) {
        console.warn("[JoinCode] Failed to dispatch member joined notification:", notifErr);
      }

      revalidatePath(`/workspaces/${workspace.slug}`);
      revalidatePath("/workspaces");

      return {
        success: true,
        requiresApproval: false,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        message: `Welcome! You have successfully joined ${workspace.name}.`,
      };
    }

    // CASE 2: PRIVATE WORKSPACE -> Join request required
    const existingReq = await prisma.workspaceJoinRequest.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    if (existingReq && existingReq.status === "PENDING") {
      return {
        success: true,
        requiresApproval: true,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        message: `Your request to join ${workspace.name} is currently pending review by the workspace owner.`,
      };
    }

    await prisma.workspaceJoinRequest.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    // Notify the workspace owner and admins about the pending join request
    try {
      await prisma.notification.create({
        data: {
          userId: workspace.ownerId,
          workspaceId: workspace.id,
          type: "WORKSPACE_JOIN_REQUEST",
          title: "Join Request Received",
          message: `${callerName} requested to join private workspace ${workspace.name} with code ${code}.`,
          link: `/workspaces/${workspace.slug}/members`,
          metadata: {
            workspaceId: workspace.id,
            applicantId: user.id,
            applicantName: callerName,
            joinCode: code,
          },
        },
      });
    } catch (notifErr) {
      console.warn("[JoinCode] Failed to dispatch join request notification:", notifErr);
    }

    return {
      success: true,
      requiresApproval: true,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      message: `Join request submitted for ${workspace.name}! The workspace owner will review your request.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to join workspace.",
    };
  }
}

/**
 * Retrieves all pending join requests for a private workspace.
 * Requires OWNER or ADMIN role.
 */
export async function getWorkspaceJoinRequests(workspaceId: string): Promise<{
  requests: WorkspaceJoinRequestItem[];
  error: string | null;
}> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const requests = await prisma.workspaceJoinRequest.findMany({
      where: {
        workspaceId: access.workspace.id,
        status: "PENDING",
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
      orderBy: { createdAt: "desc" },
    });

    const formatted: WorkspaceJoinRequestItem[] = requests.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      userId: r.userId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user.id,
        email: r.user.email,
        fullName: r.user.fullName,
        avatarUrl: r.user.avatarUrl,
      },
    }));

    return { requests: formatted, error: null };
  } catch (err: any) {
    return { requests: [], error: err.message || "Failed to load join requests." };
  }
}

/**
 * Approves or rejects a workspace join request.
 * Requires OWNER or ADMIN role.
 */
export async function reviewWorkspaceJoinRequest(
  workspaceId: string,
  requestId: string,
  action: "APPROVE" | "REJECT"
) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const request = await prisma.workspaceJoinRequest.findUnique({
      where: { id: requestId },
      include: { user: true, workspace: true },
    });

    if (!request || request.workspaceId !== access.workspace.id) {
      return { success: false, error: "Join request not found." };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: `Request has already been ${request.status.toLowerCase()}.` };
    }

    const applicantProfile = await prisma.user.findUnique({
      where: { id: access.user.id },
      select: { fullName: true },
    });
    const reviewerName = applicantProfile?.fullName || access.user.email || "An administrator";

    if (action === "APPROVE") {
      await prisma.$transaction(async (tx) => {
        await tx.workspaceJoinRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" },
        });

        const defaultRole = access.settings?.defaultMemberRole || "MEMBER";
        await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: access.workspace.id,
              userId: request.userId,
            },
          },
          create: {
            workspaceId: access.workspace.id,
            userId: request.userId,
            role: defaultRole,
            status: "ACTIVE",
          },
          update: {
            role: defaultRole,
            status: "ACTIVE",
          },
        });
      });

      // Synchronize Nexconn public channels with approved member
      try {
        const publicChannels = await prisma.workspaceChatChannel.findMany({
          where: { workspaceId: access.workspace.id, type: "PUBLIC" },
        });
        const allMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: access.workspace.id, status: "ACTIVE" },
          select: { userId: true },
        });
        for (const ch of publicChannels) {
          await syncNexconnGroupChannel(ch.nexconnChannelId, ch.name, allMembers.map((m) => m.userId));
        }
      } catch {
        // Non-blocking sync
      }

      // Notify the applicant
      try {
        await prisma.notification.create({
          data: {
            userId: request.userId,
            workspaceId: access.workspace.id,
            type: "MEMBER_JOINED",
            title: "Join Request Approved",
            message: `Your request to join ${access.workspace.name} has been approved by ${reviewerName}!`,
            link: `/workspaces/${access.workspace.slug}`,
            metadata: { workspaceId: access.workspace.id },
          },
        });
      } catch (notifErr) {
        console.warn("[JoinRequest] Failed to dispatch approval notification:", notifErr);
      }
    } else {
      // REJECT
      await prisma.workspaceJoinRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      // Notify applicant of decline
      try {
        await prisma.notification.create({
          data: {
            userId: request.userId,
            workspaceId: access.workspace.id,
            type: "SYSTEM",
            title: "Join Request Declined",
            message: `Your request to join ${access.workspace.name} was not approved.`,
            metadata: { workspaceId: access.workspace.id },
          },
        });
      } catch (notifErr) {
        console.warn("[JoinRequest] Failed to dispatch reject notification:", notifErr);
      }
    }

    revalidatePath(`/workspaces/${access.workspace.slug}/members`);
    revalidatePath("/teams");

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process join request." };
  }
}

/**
 * Toggles workspace privacy mode between Public (instant join) and Private (approval required).
 * Requires OWNER or ADMIN role.
 */
export async function toggleWorkspacePrivacy(workspaceId: string, isPrivate: boolean) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    const updated = await prisma.workspace.update({
      where: { id: access.workspace.id },
      data: { isPrivate },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/settings`);
    revalidatePath(`/workspaces/${access.workspace.slug}/members`);

    return { success: true, isPrivate: updated.isPrivate, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update workspace privacy." };
  }
}

/**
 * Regenerates the 6-character alphanumeric join code for a workspace.
 * Requires OWNER or ADMIN role.
 */
export async function regenerateWorkspaceJoinCode(workspaceId: string) {
  try {
    const access = await verifyWorkspaceAccess(workspaceId, "ADMIN");

    let newCode = generateJoinCode();
    let isUnique = false;
    while (!isUnique) {
      const existing = await prisma.workspace.findUnique({ where: { joinCode: newCode } });
      if (!existing) isUnique = true;
      else newCode = generateJoinCode();
    }

    const updated = await prisma.workspace.update({
      where: { id: access.workspace.id },
      data: { joinCode: newCode },
    });

    revalidatePath(`/workspaces/${access.workspace.slug}/settings`);
    revalidatePath(`/workspaces/${access.workspace.slug}/members`);
    revalidatePath("/teams");

    return { success: true, joinCode: updated.joinCode, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to regenerate join code." };
  }
}

