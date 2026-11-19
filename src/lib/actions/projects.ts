"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";

export interface ProjectMemberSummary {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

export interface ProjectRecordItem {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  type: "PUBLIC" | "PRIVATE";
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  members: ProjectMemberSummary[];
  memberCount: number;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    completionPercentage: number;
  };
}

/**
 * Derives an uppercase project key from a project name.
 * e.g. "Core Infrastructure" -> "CORE", "Mobile App v2" -> "MOB", "Payments" -> "PAY"
 */
function generateProjectKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const letters = words.map((w) => w[0].toUpperCase()).join("");
    return letters.slice(0, 4);
  }
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.slice(0, 4) || "PRJ";
}

/**
 * Returns all accessible projects in a workspace enriched with live progress statistics.
 * Workspace Owners & Admins see all projects.
 * Regular Members see Public projects plus Private projects where they are explicitly assigned or owner.
 */
export async function getWorkspaceProjects(
  workspaceId: string
): Promise<{ success: boolean; projects: ProjectRecordItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, projects: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const rows = await prisma.project.findMany({
      where: {
        workspaceId: access.workspace.id,
        ...(isElevated
          ? {}
          : {
              OR: [
                { type: "PUBLIC" },
                { ownerId: access.user.id },
                { members: { some: { userId: access.user.id } } },
              ],
            }),
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, avatarUrl: true, email: true },
            },
          },
        },
        tasks: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const projects: ProjectRecordItem[] = rows.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const inReview = p.tasks.filter((t) => t.status === "IN_REVIEW").length;
      const todo = p.tasks.filter((t) => t.status === "TODO" || t.status === "BACKLOG").length;
      const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;

      const membersList: ProjectMemberSummary[] = p.members.map((m) => ({
        userId: m.user.id,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
      }));

      // Ensure owner is represented if not already in members
      if (!membersList.some((m) => m.userId === p.ownerId)) {
        membersList.unshift({
          userId: p.owner.id,
          fullName: p.owner.fullName,
          avatarUrl: p.owner.avatarUrl,
          email: p.owner.email,
        });
      }

      return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name,
        key: p.key,
        description: p.description,
        type: (p.type as "PUBLIC" | "PRIVATE") || "PUBLIC",
        status: (p.status as "ACTIVE" | "ON_HOLD" | "COMPLETED") || "ACTIVE",
        color: p.color || "#7C3AED",
        ownerId: p.ownerId,
        ownerName: p.owner?.fullName || "Team Member",
        ownerAvatar: p.owner?.avatarUrl || null,
        members: membersList,
        memberCount: membersList.length,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        targetDate: p.targetDate ? p.targetDate.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        taskStats: {
          total,
          todo,
          inProgress,
          inReview,
          done,
          completionPercentage,
        },
      };
    });

    return { success: true, projects };
  } catch (err: any) {
    return { success: false, projects: [], error: err?.message || "Failed to load projects." };
  }
}

/**
 * Creates a new Project in the active workspace.
 * For private projects, assigns the selected employee members.
 */
export async function createWorkspaceProject(params: {
  workspaceId: string;
  name: string;
  key?: string;
  description?: string;
  type?: "PUBLIC" | "PRIVATE";
  memberIds?: string[];
  color?: string;
  targetDate?: string;
}): Promise<{ success: boolean; project?: ProjectRecordItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    const name = params.name?.trim();
    if (!name || name.length < 2) {
      return { success: false, error: "Project name must be at least 2 characters." };
    }

    let key = (params.key || generateProjectKey(name)).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!key) key = "PRJ";
    if (key.length > 6) key = key.slice(0, 6);

    // Ensure key uniqueness within workspace
    let uniqueKey = key;
    let suffix = 1;
    while (
      await prisma.project.findUnique({
        where: {
          workspaceId_key: {
            workspaceId: access.workspace.id,
            key: uniqueKey,
          },
        },
      })
    ) {
      uniqueKey = `${key}${suffix}`;
      suffix++;
    }

    const targetDateObj = params.targetDate ? new Date(params.targetDate) : null;
    const projectType = params.type === "PRIVATE" ? "PRIVATE" : "PUBLIC";

    // Build unique set of member IDs (always including the creator)
    const uniqueMemberIds = new Set<string>();
    uniqueMemberIds.add(access.user.id);
    if (projectType === "PRIVATE" && Array.isArray(params.memberIds)) {
      for (const mId of params.memberIds) {
        if (typeof mId === "string" && mId.trim()) {
          uniqueMemberIds.add(mId.trim());
        }
      }
    }

    const created = await prisma.project.create({
      data: {
        workspaceId: access.workspace.id,
        name,
        key: uniqueKey,
        description: params.description?.trim() || null,
        type: projectType,
        color: params.color || "#7C3AED",
        ownerId: access.user.id,
        targetDate: targetDateObj && !isNaN(targetDateObj.getTime()) ? targetDateObj : null,
        status: "ACTIVE",
        members: {
          create: Array.from(uniqueMemberIds).map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, avatarUrl: true, email: true },
            },
          },
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath("/tasks");

    const membersList: ProjectMemberSummary[] = created.members.map((m) => ({
      userId: m.user.id,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      email: m.user.email,
    }));

    return {
      success: true,
      project: {
        id: created.id,
        workspaceId: created.workspaceId,
        name: created.name,
        key: created.key,
        description: created.description,
        type: created.type as "PUBLIC" | "PRIVATE",
        status: "ACTIVE",
        color: created.color,
        ownerId: created.ownerId,
        ownerName: created.owner.fullName,
        ownerAvatar: created.owner.avatarUrl || null,
        members: membersList,
        memberCount: membersList.length,
        startDate: null,
        targetDate: created.targetDate ? created.targetDate.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
        taskStats: {
          total: 0,
          todo: 0,
          inProgress: 0,
          inReview: 0,
          done: 0,
          completionPercentage: 0,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create project." };
  }
}

/**
 * Updates project details (status, name, description, target date, color, type, members).
 */
export async function updateWorkspaceProject(
  workspaceId: string,
  projectId: string,
  data: {
    name?: string;
    description?: string;
    status?: "ACTIVE" | "ON_HOLD" | "COMPLETED";
    type?: "PUBLIC" | "PRIVATE";
    memberIds?: string[];
    color?: string;
    targetDate?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project || project.workspaceId !== access.workspace.id) {
      return { success: false, error: "Project not found in this workspace." };
    }

    if (!isElevated && project.ownerId !== access.user.id) {
      return { success: false, error: "Only project leads or workspace administrators can modify this project." };
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    }

    // Update members if memberIds provided
    if (Array.isArray(data.memberIds)) {
      const uniqueIds = new Set<string>(data.memberIds);
      uniqueIds.add(project.ownerId);

      // Reconcile project members
      await prisma.projectMember.deleteMany({
        where: { projectId: project.id },
      });

      await prisma.projectMember.createMany({
        data: Array.from(uniqueIds).map((userId) => ({
          projectId: project.id,
          userId,
        })),
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    revalidatePath("/projects");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update project." };
  }
}

/**
 * Deletes a project. Associated tasks remain in the workspace with projectId unset.
 */
export async function deleteWorkspaceProject(
  workspaceId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.workspaceId !== access.workspace.id) {
      return { success: false, error: "Project not found in this workspace." };
    }

    if (!isElevated && project.ownerId !== access.user.id) {
      return { success: false, error: "Only project leads or workspace administrators can delete this project." };
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    revalidatePath("/projects");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete project." };
  }
}
