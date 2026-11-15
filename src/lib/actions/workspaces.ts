"use server";

import { revalidatePath } from "next/cache";
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
import { Workspace, WorkspaceRole, WorkspaceType } from "@/lib/types";

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
      ownerId: existing.ownerId,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create personal workspace inside transaction
  const firstName = fullName.trim().split(" ")[0] || "Personal";
  const baseSlug = `personal-${userId.substring(0, 8)}`;

  try {
    const created = await prisma.workspace.create({
      data: {
        name: `${firstName}'s Personal Workspace`,
        slug: baseSlug,
        type: "PERSONAL",
        description: "Your private workspace for personal tasks, notes, and projects.",
        ownerId: userId,
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { workspaces: [], error: "Unauthenticated" };
  }

  try {
    // Ensure personal workspace exists
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "SPARK User";

    await ensurePersonalWorkspace(user.id, user.email || "", fullName);

    // Fetch all active memberships for user
    const memberships = await prisma.workspaceMember.findMany({
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { name, slug, description, avatarUrl } = validation.data;

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

