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

export interface ProjectMilestoneData {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
}

export interface ProjectMetricsSummary {
  totalProjects: number;
  activeProjects: number;
  onHoldProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalIssues: number;
  completedIssues: number;
  overallDeliveryRate: number;
}

export interface ProjectRecordItem {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  category: string | null;
  type: "PUBLIC" | "PRIVATE";
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  color: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  members: ProjectMemberSummary[];
  memberCount: number;
  startDate: string | null;
  targetDate: string | null;
  isOverdue: boolean;
  createdAt: string;
  taskStats: {
    total: number;
    backlog: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    overdue: number;
    completionPercentage: number;
  };
  sprintsCount?: number;
}

export interface DetailedProjectView extends ProjectRecordItem {
  milestones: ProjectMilestoneData[];
  sprints: Array<{
    id: string;
    name: string;
    goal: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    taskCount: number;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    userName: string;
    userAvatar: string | null;
    taskTitle?: string | null;
    taskKey?: string | null;
  }>;
}

/**
 * Derives a clean uppercase project key from a project name.
 * e.g. "Carbon Ledger AI" -> "CLA", "Mobile App" -> "MA", "Infrastructure" -> "INF"
 */
function deriveProjectKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const letters = words.map((w) => w[0].toUpperCase()).join("");
    return letters.slice(0, 5);
  }
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean.slice(0, 5) || "PRJ";
}

/**
 * Fetches all accessible projects for a workspace with real database-calculated metrics.
 */
export async function getWorkspaceProjects(
  workspaceId: string,
  filter?: {
    status?: string;
    visibility?: "PUBLIC" | "PRIVATE" | "ALL";
    search?: string;
  }
): Promise<{
  success: boolean;
  projects: ProjectRecordItem[];
  metrics: ProjectMetricsSummary;
  error?: string;
}> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return {
      success: true,
      projects: [],
      metrics: {
        totalProjects: 0,
        activeProjects: 0,
        onHoldProjects: 0,
        completedProjects: 0,
        overdueProjects: 0,
        totalIssues: 0,
        completedIssues: 0,
        overallDeliveryRate: 0,
      },
    };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";
    const now = new Date();

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
          select: { id: true, status: true, dueDate: true },
        },
        sprints: {
          select: { id: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    let totalIssuesAcrossAll = 0;
    let completedIssuesAcrossAll = 0;
    let overdueProjectsCount = 0;

    const allProjects: ProjectRecordItem[] = rows.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const inReview = p.tasks.filter((t) => t.status === "IN_REVIEW").length;
      const todo = p.tasks.filter((t) => t.status === "TODO").length;
      const backlog = p.tasks.filter((t) => t.status === "BACKLOG").length;
      const overdueTasks = p.tasks.filter(
        (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < now
      ).length;

      const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
      const isOverdue = Boolean(
        p.targetDate &&
          p.status !== "COMPLETED" &&
          p.status !== "ARCHIVED" &&
          new Date(p.targetDate) < now
      );

      if (isOverdue) overdueProjectsCount++;
      totalIssuesAcrossAll += total;
      completedIssuesAcrossAll += done;

      const membersList: ProjectMemberSummary[] = p.members.map((m) => ({
        userId: m.user.id,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
      }));

      if (!membersList.some((m) => m.userId === p.ownerId) && p.owner) {
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
        category: p.category,
        type: (p.type as "PUBLIC" | "PRIVATE") || "PUBLIC",
        status: (p.status as any) || "ACTIVE",
        color: p.color || "#7C3AED",
        ownerId: p.ownerId,
        ownerName: p.owner?.fullName || "Team Member",
        ownerAvatar: p.owner?.avatarUrl || null,
        members: membersList,
        memberCount: membersList.length,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        targetDate: p.targetDate ? p.targetDate.toISOString() : null,
        isOverdue,
        createdAt: p.createdAt.toISOString(),
        taskStats: {
          total,
          backlog,
          todo,
          inProgress,
          inReview,
          done,
          overdue: overdueTasks,
          completionPercentage,
        },
        sprintsCount: p.sprints.length,
      };
    });

    const metrics: ProjectMetricsSummary = {
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter((p) => p.status === "ACTIVE").length,
      onHoldProjects: allProjects.filter((p) => p.status === "ON_HOLD").length,
      completedProjects: allProjects.filter((p) => p.status === "COMPLETED").length,
      overdueProjects: overdueProjectsCount,
      totalIssues: totalIssuesAcrossAll,
      completedIssues: completedIssuesAcrossAll,
      overallDeliveryRate:
        totalIssuesAcrossAll > 0
          ? Math.round((completedIssuesAcrossAll / totalIssuesAcrossAll) * 100)
          : 0,
    };

    // Apply filtering if supplied
    let filtered = allProjects;
    if (filter) {
      if (filter.status && filter.status !== "ALL") {
        filtered = filtered.filter((p) => p.status === filter.status);
      }
      if (filter.visibility && filter.visibility !== "ALL") {
        filtered = filtered.filter((p) => p.type === filter.visibility);
      }
      if (filter.search?.trim()) {
        const q = filter.search.toLowerCase().trim();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
        );
      }
    }

    return { success: true, projects: filtered, metrics };
  } catch (err: any) {
    return {
      success: false,
      projects: [],
      metrics: {
        totalProjects: 0,
        activeProjects: 0,
        onHoldProjects: 0,
        completedProjects: 0,
        overdueProjects: 0,
        totalIssues: 0,
        completedIssues: 0,
        overallDeliveryRate: 0,
      },
      error: err?.message || "Failed to load projects.",
    };
  }
}

/**
 * Fetches a single project by its unique workspace-level key with comprehensive details.
 */
export async function getProjectByKey(
  workspaceId: string,
  projectKey: string
): Promise<{ success: boolean; project?: DetailedProjectView; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const normalizedKey = projectKey.toUpperCase().trim();
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";
    const now = new Date();

    const p = await prisma.project.findUnique({
      where: {
        workspaceId_key: {
          workspaceId: access.workspace.id,
          key: normalizedKey,
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
        tasks: {
          select: { id: true, status: true, priority: true, dueDate: true },
        },
        sprints: {
          include: {
            tasks: { select: { id: true } },
          },
          orderBy: [{ createdAt: "desc" }],
        },
        milestones: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
        activities: {
          take: 25,
          orderBy: [{ createdAt: "desc" }],
          include: {
            user: { select: { fullName: true, avatarUrl: true } },
            task: { select: { title: true, issueKey: true } },
          },
        },
      },
    });

    if (!p) {
      return { success: false, error: `Project [${normalizedKey}] not found in this workspace.` };
    }

    // Enforce private project authorization
    if (p.type === "PRIVATE" && !isElevated && p.ownerId !== access.user.id) {
      const isMember = p.members.some((m) => m.userId === access.user.id);
      if (!isMember) {
        return { success: false, error: "Access denied. You are not a member of this private project." };
      }
    }

    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const inReview = p.tasks.filter((t) => t.status === "IN_REVIEW").length;
    const todo = p.tasks.filter((t) => t.status === "TODO").length;
    const backlog = p.tasks.filter((t) => t.status === "BACKLOG").length;
    const overdueTasks = p.tasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
    const isOverdue = Boolean(
      p.targetDate &&
        p.status !== "COMPLETED" &&
        p.status !== "ARCHIVED" &&
        new Date(p.targetDate) < now
    );

    const membersList: ProjectMemberSummary[] = p.members.map((m) => ({
      userId: m.user.id,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      email: m.user.email,
    }));

    if (!membersList.some((m) => m.userId === p.ownerId) && p.owner) {
      membersList.unshift({
        userId: p.owner.id,
        fullName: p.owner.fullName,
        avatarUrl: p.owner.avatarUrl,
        email: p.owner.email,
      });
    }

    const detailed: DetailedProjectView = {
      id: p.id,
      workspaceId: p.workspaceId,
      name: p.name,
      key: p.key,
      description: p.description,
      category: p.category,
      type: (p.type as "PUBLIC" | "PRIVATE") || "PUBLIC",
      status: (p.status as any) || "ACTIVE",
      color: p.color || "#7C3AED",
      ownerId: p.ownerId,
      ownerName: p.owner?.fullName || "Team Member",
      ownerAvatar: p.owner?.avatarUrl || null,
      members: membersList,
      memberCount: membersList.length,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      targetDate: p.targetDate ? p.targetDate.toISOString() : null,
      isOverdue,
      createdAt: p.createdAt.toISOString(),
      taskStats: {
        total,
        backlog,
        todo,
        inProgress,
        inReview,
        done,
        overdue: overdueTasks,
        completionPercentage,
      },
      sprintsCount: p.sprints.length,
      milestones: p.milestones.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        title: m.title,
        description: m.description,
        dueDate: m.dueDate ? m.dueDate.toISOString() : null,
        isCompleted: m.isCompleted,
        createdAt: m.createdAt.toISOString(),
      })),
      sprints: p.sprints.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        status: s.status,
        startDate: s.startDate ? s.startDate.toISOString() : null,
        endDate: s.endDate ? s.endDate.toISOString() : null,
        taskCount: s.tasks.length,
      })),
      recentActivities: p.activities.map((a) => ({
        id: a.id,
        action: a.action,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        createdAt: a.createdAt.toISOString(),
        userName: a.user.fullName,
        userAvatar: a.user.avatarUrl,
        taskTitle: a.task?.title || null,
        taskKey: a.task?.issueKey || null,
      })),
    };

    return { success: true, project: detailed };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load project details." };
  }
}

/**
 * Creates a project with comprehensive validation, unique key guarantee, and activity log.
 */
export async function createWorkspaceProject(params: {
  workspaceId: string;
  name: string;
  key?: string;
  description?: string;
  category?: string;
  type?: "PUBLIC" | "PRIVATE";
  status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  memberIds?: string[];
  color?: string;
  startDate?: string;
  targetDate?: string;
}): Promise<{ success: boolean; project?: ProjectRecordItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    const name = params.name?.trim();
    if (!name || name.length < 2) {
      return { success: false, error: "Project name must be at least 2 characters." };
    }

    let key = (params.key || deriveProjectKey(name)).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!key) key = "PRJ";
    if (key.length > 8) key = key.slice(0, 8);

    // Validate uniqueness in workspace
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

    const startDateObj = params.startDate ? new Date(params.startDate) : null;
    const targetDateObj = params.targetDate ? new Date(params.targetDate) : null;
    const projectType = params.type === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const projectStatus = params.status || "ACTIVE";

    const uniqueMemberIds = new Set<string>();
    uniqueMemberIds.add(access.user.id);
    if (Array.isArray(params.memberIds)) {
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
        category: params.category?.trim() || null,
        type: projectType,
        color: params.color || "#7C3AED",
        status: projectStatus,
        ownerId: access.user.id,
        startDate: startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj : null,
        targetDate: targetDateObj && !isNaN(targetDateObj.getTime()) ? targetDateObj : null,
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
    revalidatePath(`/projects/${created.key}`);
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
        category: created.category,
        type: created.type as "PUBLIC" | "PRIVATE",
        status: created.status as any,
        color: created.color,
        ownerId: created.ownerId,
        ownerName: created.owner.fullName,
        ownerAvatar: created.owner.avatarUrl || null,
        members: membersList,
        memberCount: membersList.length,
        startDate: created.startDate ? created.startDate.toISOString() : null,
        targetDate: created.targetDate ? created.targetDate.toISOString() : null,
        isOverdue: false,
        createdAt: created.createdAt.toISOString(),
        taskStats: {
          total: 0,
          backlog: 0,
          todo: 0,
          inProgress: 0,
          inReview: 0,
          done: 0,
          overdue: 0,
          completionPercentage: 0,
        },
        sprintsCount: 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create project." };
  }
}

/**
 * Updates an existing project's metadata, status, visibility, and members.
 */
export async function updateWorkspaceProject(
  workspaceId: string,
  projectId: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
    type?: "PUBLIC" | "PRIVATE";
    color?: string;
    startDate?: string | null;
    targetDate?: string | null;
    memberIds?: string[];
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
      return {
        success: false,
        error: "Only project owners or workspace administrators can modify project settings.",
      };
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.category !== undefined) updateData.category = data.category?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    }

    if (Array.isArray(data.memberIds)) {
      const uniqueIds = new Set<string>(data.memberIds);
      uniqueIds.add(project.ownerId);

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
    revalidatePath(`/projects/${project.key}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update project." };
  }
}

/**
 * Archives a project (safe soft-deactivation).
 */
export async function archiveWorkspaceProject(
  workspaceId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  return updateWorkspaceProject(workspaceId, projectId, { status: "ARCHIVED" });
}

/**
 * Restores an archived project back to ACTIVE status.
 */
export async function restoreWorkspaceProject(
  workspaceId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  return updateWorkspaceProject(workspaceId, projectId, { status: "ACTIVE" });
}

/**
 * Deletes a project. Unsets projectId from associated tasks rather than deleting user issues.
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
      return {
        success: false,
        error: "Only project owners or workspace administrators can permanently delete projects.",
      };
    }

    // Unset projectId on tasks before deleting to avoid orphan loss
    await prisma.task.updateMany({
      where: { projectId },
      data: { projectId: null },
    });

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

/**
 * Adds an existing workspace member to a project.
 */
export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.workspaceId !== access.workspace.id) {
      return { success: false, error: "Project not found." };
    }

    if (!isElevated && project.ownerId !== access.user.id) {
      return { success: false, error: "Not authorized to manage project members." };
    }

    // Verify user is in workspace
    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.workspace.id, userId } },
    });
    if (!wsMember) {
      return { success: false, error: "Selected user is not a member of this workspace." };
    }

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });

    revalidatePath(`/projects/${project.key}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to add member to project." };
  }
}

/**
 * Removes a member from a project.
 */
export async function removeProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.workspaceId !== access.workspace.id) {
      return { success: false, error: "Project not found." };
    }

    if (userId === project.ownerId) {
      return { success: false, error: "Cannot remove the project lead." };
    }

    if (!isElevated && project.ownerId !== access.user.id && access.user.id !== userId) {
      return { success: false, error: "Not authorized to remove members." };
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    revalidatePath(`/projects/${project.key}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to remove member from project." };
  }
}

/**
 * Project Milestone Actions
 */
export async function createProjectMilestone(params: {
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate?: string;
}): Promise<{ success: boolean; milestone?: ProjectMilestoneData; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);
    const title = params.title.trim();
    if (!title) return { success: false, error: "Milestone title is required." };

    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    if (!project || project.workspaceId !== access.workspace.id) {
      return { success: false, error: "Project not found." };
    }

    const dueDateObj = params.dueDate ? new Date(params.dueDate) : null;

    const created = await prisma.projectMilestone.create({
      data: {
        workspaceId: access.workspace.id,
        projectId: params.projectId,
        title,
        description: params.description?.trim() || null,
        dueDate: dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj : null,
      },
    });

    revalidatePath(`/projects/${project.key}`);

    return {
      success: true,
      milestone: {
        id: created.id,
        projectId: created.projectId,
        title: created.title,
        description: created.description,
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        isCompleted: created.isCompleted,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create milestone." };
  }
}

export async function toggleProjectMilestone(
  workspaceId: string,
  milestoneId: string,
  isCompleted: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const ms = await prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });
    if (!ms || ms.workspaceId !== access.workspace.id) {
      return { success: false, error: "Milestone not found." };
    }

    await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { isCompleted },
    });

    revalidatePath(`/projects/${ms.project.key}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to toggle milestone." };
  }
}

export async function deleteProjectMilestone(
  workspaceId: string,
  milestoneId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const ms = await prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });
    if (!ms || ms.workspaceId !== access.workspace.id) {
      return { success: false, error: "Milestone not found." };
    }

    await prisma.projectMilestone.delete({ where: { id: milestoneId } });
    revalidatePath(`/projects/${ms.project.key}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete milestone." };
  }
}
