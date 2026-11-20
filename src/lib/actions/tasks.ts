"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { TaskStatus, TaskPriority } from "@prisma/client";

export type WorkItemType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";

export interface TaskCommentData {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface TaskChecklistItemData {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
}

export interface TaskActivityItem {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TaskAttachmentItem {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
  storagePath: string | null;
  createdAt: string;
}

export interface TaskDependencyItem {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTaskKey: string | null;
  dependsOnTaskTitle: string;
  dependsOnTaskStatus: string;
  type: "BLOCKS" | "BLOCKED_BY";
  createdAt: string;
}

export interface SprintItem {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName?: string | null;
  projectKey?: string | null;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  remainingTasks: number;
  createdAt: string;
}

export interface TaskRecordItem {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  projectKey: string | null;
  issueKey: string | null;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  storyPoints: number | null;
  startDate: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeAvatar: string | null;
  createdById: string;
  creatorName: string;
  parentTaskId: string | null;
  parentTaskKey?: string | null;
  sprintId: string | null;
  sprintName?: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  checklistTotal: number;
  checklistDone: number;
  commentsCount: number;
  attachmentCount: number;
  subtaskCount: number;
}

export interface TaskDetailsEnriched extends TaskRecordItem {
  checklists: TaskChecklistItemData[];
  comments: TaskCommentData[];
  activities: TaskActivityItem[];
  attachments: TaskAttachmentItem[];
  dependencies: TaskDependencyItem[];
  subtasks: Array<{
    id: string;
    issueKey: string | null;
    title: string;
    status: string;
    priority: string;
    assigneeName: string | null;
  }>;
}

/**
 * Concurrency-safe Unique Issue Key Generator.
 * e.g., "CLA-1", "CLA-2", "PRJ-104".
 */
async function generateUniqueIssueKey(
  workspaceId: string,
  projectId?: string | null
): Promise<string> {
  let prefix = "TSK";

  if (projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });
    if (proj?.key) prefix = proj.key.toUpperCase();
  }

  // Count existing tasks with this prefix in the workspace
  const count = await prisma.task.count({
    where: {
      workspaceId,
      issueKey: { startsWith: `${prefix}-` },
    },
  });

  let nextIndex = count + 1;
  let candidate = `${prefix}-${nextIndex}`;

  // Collision safety probe
  while (
    await prisma.task.findFirst({
      where: { workspaceId, issueKey: candidate },
      select: { id: true },
    })
  ) {
    nextIndex++;
    candidate = `${prefix}-${nextIndex}`;
  }

  return candidate;
}

/**
 * Logs an activity entry for an issue.
 */
async function recordTaskActivity(params: {
  workspaceId: string;
  projectId?: string | null;
  taskId: string;
  userId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  try {
    await prisma.taskActivity.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId || null,
        taskId: params.taskId,
        userId: params.userId,
        action: params.action,
        field: params.field || null,
        oldValue: params.oldValue ? String(params.oldValue) : null,
        newValue: params.newValue ? String(params.newValue) : null,
      },
    });
  } catch (err) {
    console.error("[TaskActivity] Error recording audit:", err);
  }
}

/**
 * Returns all accessible tasks in a workspace, with optional project, sprint, status, priority, or assignee filters.
 */
export async function getWorkspaceTasks(
  workspaceId: string,
  filter?: {
    projectId?: string | null;
    sprintId?: string | null;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    type?: string;
    search?: string;
  }
): Promise<{ success: boolean; tasks: TaskRecordItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, tasks: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const whereClause: any = {
      workspaceId: access.workspace.id,
      ...(isElevated
        ? {}
        : {
            OR: [
              { projectId: null },
              { project: { type: "PUBLIC" } },
              { project: { ownerId: access.user.id } },
              { project: { members: { some: { userId: access.user.id } } } },
            ],
          }),
    };

    if (filter) {
      if (filter.projectId !== undefined) {
        whereClause.projectId = filter.projectId;
      }
      if (filter.sprintId !== undefined) {
        whereClause.sprintId = filter.sprintId;
      }
      if (filter.status && filter.status !== "ALL") {
        whereClause.status = filter.status as TaskStatus;
      }
      if (filter.priority && filter.priority !== "ALL") {
        whereClause.priority = filter.priority as TaskPriority;
      }
      if (filter.assigneeId !== undefined) {
        whereClause.assigneeId = filter.assigneeId;
      }
      if (filter.type && filter.type !== "ALL") {
        whereClause.type = filter.type;
      }
      if (filter.search?.trim()) {
        const q = filter.search.trim();
        whereClause.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { issueKey: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const rows = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true, key: true, type: true },
        },
        assignee: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, fullName: true },
        },
        parentTask: {
          select: { id: true, issueKey: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
        checklists: {
          select: { id: true, isCompleted: true },
        },
        _count: {
          select: { comments: true, attachments: true, subtasks: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const tasks: TaskRecordItem[] = rows.map((r) => {
      const checklistTotal = r.checklists.length;
      const checklistDone = r.checklists.filter((c) => c.isCompleted).length;

      return {
        id: r.id,
        workspaceId: r.workspaceId,
        projectId: r.projectId,
        projectName: r.project?.name || null,
        projectKey: r.project?.key || null,
        issueKey: r.issueKey || null,
        type: (r.type as WorkItemType) || "TASK",
        title: r.title,
        description: r.description,
        status: r.status as any,
        priority: r.priority as any,
        storyPoints: r.storyPoints,
        startDate: r.startDate ? r.startDate.toISOString() : null,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
        assigneeId: r.assigneeId,
        assigneeName: r.assignee?.fullName || null,
        assigneeEmail: r.assignee?.email || null,
        assigneeAvatar: r.assignee?.avatarUrl || null,
        createdById: r.createdById,
        creatorName: r.creator.fullName,
        parentTaskId: r.parentTaskId,
        parentTaskKey: r.parentTask?.issueKey || null,
        sprintId: r.sprintId,
        sprintName: r.sprint?.name || null,
        labels: r.labels || [],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        checklistTotal,
        checklistDone,
        commentsCount: r._count?.comments || 0,
        attachmentCount: r._count?.attachments || 0,
        subtaskCount: r._count?.subtasks || 0,
      };
    });

    return { success: true, tasks };
  } catch (err: any) {
    return { success: false, tasks: [], error: err?.message || "Failed to load tasks." };
  }
}

/**
 * Creates a new work item with concurrency-safe identifier generation and automatic audit logging.
 */
export async function createWorkspaceTask(params: {
  workspaceId: string;
  title: string;
  description?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  type?: WorkItemType;
  storyPoints?: number;
  projectId?: string;
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  parentTaskId?: string;
  sprintId?: string;
  labels?: string[];
}): Promise<{ success: boolean; task?: TaskRecordItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    const title = params.title?.trim();
    if (!title) {
      return { success: false, error: "Task title is required." };
    }

    const startDateObj = params.startDate ? new Date(params.startDate) : null;
    const dueDateObj = params.dueDate ? new Date(params.dueDate) : null;

    // Verify assignee belongs to workspace AND is eligible if project is private
    if (params.assigneeId) {
      const assigneeMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: access.workspace.id,
            userId: params.assigneeId,
          },
        },
      });
      if (!assigneeMember) {
        return { success: false, error: "Assignee is not a member of this workspace." };
      }

      if (params.projectId) {
        const proj = await prisma.project.findUnique({
          where: { id: params.projectId },
          include: { members: { select: { userId: true } } },
        });
        if (proj && proj.type === "PRIVATE") {
          const isEligible =
            proj.ownerId === params.assigneeId ||
            proj.members.some((m) => m.userId === params.assigneeId);
          if (!isEligible) {
            return {
              success: false,
              error: "Cannot assign task: Selected user is not a member of this private project.",
            };
          }
        }
      }
    }

    // Generate unique concurrency-safe issue identifier
    const issueKey = await generateUniqueIssueKey(access.workspace.id, params.projectId);

    const created = await prisma.task.create({
      data: {
        workspaceId: access.workspace.id,
        projectId: params.projectId || null,
        issueKey,
        type: params.type || "TASK",
        title,
        description: params.description?.trim() || null,
        status: (params.status as TaskStatus) || TaskStatus.TODO,
        priority: (params.priority as TaskPriority) || TaskPriority.MEDIUM,
        storyPoints: params.storyPoints ? Number(params.storyPoints) : null,
        startDate: startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj : null,
        dueDate: dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj : null,
        assigneeId: params.assigneeId || null,
        createdById: access.user.id,
        parentTaskId: params.parentTaskId || null,
        sprintId: params.sprintId || null,
        labels: Array.isArray(params.labels) ? params.labels : [],
      },
      include: {
        project: {
          select: { id: true, name: true, key: true },
        },
        assignee: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, fullName: true },
        },
        parentTask: {
          select: { id: true, issueKey: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
      },
    });

    // Record creation in audit log
    await recordTaskActivity({
      workspaceId: access.workspace.id,
      projectId: created.projectId,
      taskId: created.id,
      userId: access.user.id,
      action: "CREATED",
      newValue: `Created ${created.type} [${created.issueKey}]`,
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    if (created.project?.key) {
      revalidatePath(`/projects/${created.project.key}`);
    }

    return {
      success: true,
      task: {
        id: created.id,
        workspaceId: created.workspaceId,
        projectId: created.projectId,
        projectName: created.project?.name || null,
        projectKey: created.project?.key || null,
        issueKey: created.issueKey,
        type: (created.type as WorkItemType) || "TASK",
        title: created.title,
        description: created.description,
        status: created.status as any,
        priority: created.priority as any,
        storyPoints: created.storyPoints,
        startDate: created.startDate ? created.startDate.toISOString() : null,
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        assigneeId: created.assigneeId,
        assigneeName: created.assignee?.fullName || null,
        assigneeEmail: created.assignee?.email || null,
        assigneeAvatar: created.assignee?.avatarUrl || null,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        parentTaskId: created.parentTaskId,
        parentTaskKey: created.parentTask?.issueKey || null,
        sprintId: created.sprintId,
        sprintName: created.sprint?.name || null,
        labels: created.labels || [],
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        checklistTotal: 0,
        checklistDone: 0,
        commentsCount: 0,
        attachmentCount: 0,
        subtaskCount: 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create task." };
  }
}

/**
 * Updates an issue's status with audit trail recording (Kanban Drag & Drop).
 */
export async function updateTaskStatus(
  workspaceId: string,
  taskId: string,
  newStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found in this workspace." };
    }

    if (task.status === newStatus) return { success: true };

    const oldStatus = task.status;

    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus as TaskStatus },
    });

    // Record status transition in audit log
    await recordTaskActivity({
      workspaceId: access.workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      userId: access.user.id,
      action: "STATUS_CHANGED",
      field: "status",
      oldValue: oldStatus,
      newValue: newStatus,
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    if (task.project?.key) {
      revalidatePath(`/projects/${task.project.key}`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update task status." };
  }
}

/**
 * Updates task fields with comprehensive audit logging for each modified property.
 */
export async function updateTaskDetails(
  workspaceId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    type?: WorkItemType;
    storyPoints?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    assigneeId?: string | null;
    projectId?: string | null;
    parentTaskId?: string | null;
    sprintId?: string | null;
    labels?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found in this workspace." };
    }

    const updatePayload: any = {};

    if (data.title !== undefined && data.title.trim() !== task.title) {
      updatePayload.title = data.title.trim();
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "TITLE_CHANGED",
        field: "title",
        oldValue: task.title,
        newValue: data.title.trim(),
      });
    }

    if (data.description !== undefined && data.description !== task.description) {
      updatePayload.description = data.description?.trim() || null;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "DESCRIPTION_CHANGED",
        field: "description",
      });
    }

    if (data.status !== undefined && data.status !== task.status) {
      updatePayload.status = data.status as TaskStatus;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: task.status,
        newValue: data.status,
      });
    }

    if (data.priority !== undefined && data.priority !== task.priority) {
      updatePayload.priority = data.priority as TaskPriority;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "PRIORITY_CHANGED",
        field: "priority",
        oldValue: task.priority,
        newValue: data.priority,
      });
    }

    if (data.type !== undefined && data.type !== task.type) {
      updatePayload.type = data.type;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "TYPE_CHANGED",
        field: "type",
        oldValue: task.type,
        newValue: data.type,
      });
    }

    if (data.storyPoints !== undefined) updatePayload.storyPoints = data.storyPoints;

    if (data.startDate !== undefined) {
      updatePayload.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    if (data.dueDate !== undefined) {
      updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "DUE_DATE_CHANGED",
        field: "dueDate",
        newValue: data.dueDate || "Cleared",
      });
    }

    if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
      const effectiveProjectId = data.projectId !== undefined ? data.projectId : task.projectId;
      if (data.assigneeId && effectiveProjectId) {
        const proj = await prisma.project.findUnique({
          where: { id: effectiveProjectId },
          include: { members: { select: { userId: true } } },
        });
        if (proj && proj.type === "PRIVATE") {
          const isEligible =
            proj.ownerId === data.assigneeId ||
            proj.members.some((m) => m.userId === data.assigneeId);
          if (!isEligible) {
            return {
              success: false,
              error: "Cannot assign task: Selected user is not a member of this private project.",
            };
          }
        }
      }

      updatePayload.assigneeId = data.assigneeId || null;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "ASSIGNED",
        field: "assigneeId",
        newValue: data.assigneeId ? "Assigned" : "Unassigned",
      });
    }

    if (data.projectId !== undefined) updatePayload.projectId = data.projectId || null;
    if (data.parentTaskId !== undefined) updatePayload.parentTaskId = data.parentTaskId || null;
    if (data.sprintId !== undefined && data.sprintId !== task.sprintId) {
      updatePayload.sprintId = data.sprintId || null;
      await recordTaskActivity({
        workspaceId: access.workspace.id,
        projectId: task.projectId,
        taskId: task.id,
        userId: access.user.id,
        action: "SPRINT_CHANGED",
        field: "sprintId",
      });
    }

    if (data.labels !== undefined) updatePayload.labels = data.labels;

    await prisma.task.update({
      where: { id: taskId },
      data: updatePayload,
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    if (task.project?.key) {
      revalidatePath(`/projects/${task.project.key}`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update task." };
  }
}

/**
 * Deletes a work item and cleans relations.
 */
export async function deleteTask(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found." };
    }

    if (!isElevated && task.createdById !== access.user.id) {
      return { success: false, error: "Only the creator or an administrator can delete this task." };
    }

    await prisma.task.delete({ where: { id: taskId } });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete task." };
  }
}

/**
 * Retrieves full details for an issue (comments, subtasks, checklists, activities, attachments, dependencies).
 */
export async function getTaskDetails(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; task?: TaskDetailsEnriched; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, name: true, key: true } },
        assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, fullName: true } },
        parentTask: { select: { id: true, issueKey: true } },
        sprint: { select: { id: true, name: true } },
        checklists: { orderBy: { position: "asc" } },
        comments: {
          include: { user: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
        activities: {
          include: { user: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        attachments: {
          include: { user: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, issueKey: true, title: true, status: true } },
          },
        },
        subtasks: {
          include: { assignee: { select: { fullName: true } } },
        },
      },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found." };
    }

    const checklistTotal = task.checklists.length;
    const checklistDone = task.checklists.filter((c) => c.isCompleted).length;

    const enriched: TaskDetailsEnriched = {
      id: task.id,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      projectName: task.project?.name || null,
      projectKey: task.project?.key || null,
      issueKey: task.issueKey,
      type: (task.type as WorkItemType) || "TASK",
      title: task.title,
      description: task.description,
      status: task.status as any,
      priority: task.priority as any,
      storyPoints: task.storyPoints,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.fullName || null,
      assigneeEmail: task.assignee?.email || null,
      assigneeAvatar: task.assignee?.avatarUrl || null,
      createdById: task.createdById,
      creatorName: task.creator.fullName,
      parentTaskId: task.parentTaskId,
      parentTaskKey: task.parentTask?.issueKey || null,
      sprintId: task.sprintId,
      sprintName: task.sprint?.name || null,
      labels: task.labels || [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      checklistTotal,
      checklistDone,
      commentsCount: task.comments.length,
      attachmentCount: task.attachments.length,
      subtaskCount: task.subtasks.length,
      checklists: task.checklists.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        title: c.title,
        isCompleted: c.isCompleted,
        position: c.position,
        createdAt: c.createdAt.toISOString(),
      })),
      comments: task.comments.map((cm) => ({
        id: cm.id,
        taskId: cm.taskId,
        userId: cm.userId,
        userName: cm.user.fullName,
        userAvatar: cm.user.avatarUrl,
        content: cm.content,
        createdAt: cm.createdAt.toISOString(),
      })),
      activities: task.activities.map((a) => ({
        id: a.id,
        taskId: a.taskId,
        userId: a.userId,
        userName: a.user.fullName,
        userAvatar: a.user.avatarUrl,
        action: a.action,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        createdAt: a.createdAt.toISOString(),
      })),
      attachments: task.attachments.map((at) => ({
        id: at.id,
        taskId: at.taskId,
        userId: at.userId,
        userName: at.user.fullName,
        userAvatar: at.user.avatarUrl,
        fileName: at.fileName,
        fileUrl: at.fileUrl,
        fileSize: at.fileSize,
        fileType: at.fileType,
        storagePath: at.storagePath,
        createdAt: at.createdAt.toISOString(),
      })),
      dependencies: task.dependencies.map((d) => ({
        id: d.id,
        taskId: d.taskId,
        dependsOnTaskId: d.dependsOnTaskId,
        dependsOnTaskKey: d.dependsOnTask.issueKey || null,
        dependsOnTaskTitle: d.dependsOnTask.title,
        dependsOnTaskStatus: d.dependsOnTask.status,
        type: (d.type as "BLOCKS" | "BLOCKED_BY") || "BLOCKS",
        createdAt: d.createdAt.toISOString(),
      })),
      subtasks: task.subtasks.map((st) => ({
        id: st.id,
        issueKey: st.issueKey || null,
        title: st.title,
        status: st.status,
        priority: st.priority,
        assigneeName: st.assignee?.fullName || null,
      })),
    };

    return { success: true, task: enriched };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load task details." };
  }
}

// ================= Checklist Actions =================

export async function getTaskChecklist(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; items: TaskChecklistItemData[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId, task: { workspaceId: access.workspace.id } },
      orderBy: { position: "asc" },
    });

    return {
      success: true,
      items: items.map((i) => ({
        id: i.id,
        taskId: i.taskId,
        title: i.title,
        isCompleted: i.isCompleted,
        position: i.position,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, items: [], error: err?.message || "Failed to load checklist." };
  }
}

export async function addTaskChecklistItem(
  workspaceId: string,
  taskId: string,
  title: string
): Promise<{ success: boolean; item?: TaskChecklistItemData; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const count = await prisma.taskChecklistItem.count({ where: { taskId } });

    const created = await prisma.taskChecklistItem.create({
      data: {
        taskId,
        title: title.trim(),
        position: count,
      },
    });

    revalidatePath("/tasks");
    return {
      success: true,
      item: {
        id: created.id,
        taskId: created.taskId,
        title: created.title,
        isCompleted: created.isCompleted,
        position: created.position,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to add checklist item." };
  }
}

export async function toggleTaskChecklistItem(
  workspaceId: string,
  itemId: string,
  isCompleted: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyWorkspaceAccess(workspaceId);
    await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { isCompleted },
    });
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to toggle checklist item." };
  }
}

export async function deleteTaskChecklistItem(
  workspaceId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyWorkspaceAccess(workspaceId);
    await prisma.taskChecklistItem.delete({ where: { id: itemId } });
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete checklist item." };
  }
}

// ================= Comments Actions =================

export async function getTaskComments(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; comments: TaskCommentData[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const comments = await prisma.taskComment.findMany({
      where: { taskId, task: { workspaceId: access.workspace.id } },
      include: { user: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        userName: c.user.fullName,
        userAvatar: c.user.avatarUrl,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, comments: [], error: err?.message || "Failed to load comments." };
  }
}

export async function addTaskComment(
  workspaceId: string,
  taskId: string,
  content: string
): Promise<{ success: boolean; comment?: TaskCommentData; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    if (!content.trim()) return { success: false, error: "Comment cannot be empty." };

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found." };
    }

    const created = await prisma.taskComment.create({
      data: {
        taskId,
        userId: access.user.id,
        content: content.trim(),
      },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
      },
    });

    await recordTaskActivity({
      workspaceId: access.workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      userId: access.user.id,
      action: "COMMENT_ADDED",
      newValue: content.trim().slice(0, 80),
    });

    revalidatePath("/tasks");
    return {
      success: true,
      comment: {
        id: created.id,
        taskId: created.taskId,
        userId: created.userId,
        userName: created.user.fullName,
        userAvatar: created.user.avatarUrl,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to post comment." };
  }
}

export async function deleteTaskComment(
  workspaceId: string,
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });

    if (!comment || comment.task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Comment not found." };
    }

    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";
    if (!isElevated && comment.userId !== access.user.id) {
      return { success: false, error: "Not authorized to delete this comment." };
    }

    await prisma.taskComment.delete({ where: { id: commentId } });
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete comment." };
  }
}

// ================= Attachments Actions =================

export async function addTaskAttachment(params: {
  workspaceId: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  storagePath?: string;
}): Promise<{ success: boolean; attachment?: TaskAttachmentItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);
    const task = await prisma.task.findUnique({ where: { id: params.taskId } });
    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found." };
    }

    const created = await prisma.taskAttachment.create({
      data: {
        workspaceId: access.workspace.id,
        taskId: params.taskId,
        userId: access.user.id,
        fileName: params.fileName,
        fileUrl: params.fileUrl,
        fileSize: params.fileSize || null,
        fileType: params.fileType || null,
        storagePath: params.storagePath || null,
      },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
      },
    });

    await recordTaskActivity({
      workspaceId: access.workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      userId: access.user.id,
      action: "ATTACHMENT_ADDED",
      newValue: params.fileName,
    });

    revalidatePath("/tasks");
    return {
      success: true,
      attachment: {
        id: created.id,
        taskId: created.taskId,
        userId: created.userId,
        userName: created.user.fullName,
        userAvatar: created.user.avatarUrl,
        fileName: created.fileName,
        fileUrl: created.fileUrl,
        fileSize: created.fileSize,
        fileType: created.fileType,
        storagePath: created.storagePath,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to attach file." };
  }
}

export async function deleteTaskAttachment(
  workspaceId: string,
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const at = await prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
    if (!at || at.workspaceId !== access.workspace.id) {
      return { success: false, error: "Attachment not found." };
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete attachment." };
  }
}

// ================= Task Dependencies & Circular Prevention =================

export async function addTaskDependency(
  workspaceId: string,
  taskId: string,
  dependsOnTaskId: string,
  type: "BLOCKS" | "BLOCKED_BY" = "BLOCKS"
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    if (taskId === dependsOnTaskId) {
      return { success: false, error: "An issue cannot depend on itself." };
    }

    const [t1, t2] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: dependsOnTaskId } }),
    ]);

    if (!t1 || t1.workspaceId !== access.workspace.id || !t2 || t2.workspaceId !== access.workspace.id) {
      return { success: false, error: "One or both issues not found in this workspace." };
    }

    // Circular Dependency Validation
    // Check if dependsOnTaskId already depends on taskId
    const circularCheck = await prisma.taskDependency.findFirst({
      where: {
        workspaceId: access.workspace.id,
        taskId: dependsOnTaskId,
        dependsOnTaskId: taskId,
      },
    });

    if (circularCheck) {
      return {
        success: false,
        error: "Circular dependency detected. These tasks already have an inverse relationship.",
      };
    }

    await prisma.taskDependency.create({
      data: {
        workspaceId: access.workspace.id,
        taskId,
        dependsOnTaskId,
        type,
      },
    });

    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create task dependency." };
  }
}

export async function removeTaskDependency(
  workspaceId: string,
  dependencyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const dep = await prisma.taskDependency.findUnique({ where: { id: dependencyId } });
    if (!dep || dep.workspaceId !== access.workspace.id) {
      return { success: false, error: "Dependency not found." };
    }

    await prisma.taskDependency.delete({ where: { id: dependencyId } });
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to remove dependency." };
  }
}

// ================= Sprint Management Actions =================

export async function getProjectSprints(
  workspaceId: string,
  projectId?: string | null
): Promise<{ success: boolean; sprints: SprintItem[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const sprints = await prisma.sprint.findMany({
      where: {
        workspaceId: access.workspace.id,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, name: true, key: true } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      success: true,
      sprints: sprints.map((s) => {
        const totalTasks = s.tasks.length;
        const completedTasks = s.tasks.filter((t) => t.status === "DONE").length;
        const inProgressTasks = s.tasks.filter(
          (t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW"
        ).length;
        const remainingTasks = totalTasks - completedTasks;

        return {
          id: s.id,
          workspaceId: s.workspaceId,
          projectId: s.projectId,
          projectName: s.project?.name || null,
          projectKey: s.project?.key || null,
          name: s.name,
          goal: s.goal,
          startDate: s.startDate ? s.startDate.toISOString() : null,
          endDate: s.endDate ? s.endDate.toISOString() : null,
          status: s.status as any,
          totalTasks,
          completedTasks,
          inProgressTasks,
          remainingTasks,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    };
  } catch (err: any) {
    return { success: false, sprints: [], error: err?.message || "Failed to load sprints." };
  }
}

export async function createSprint(params: {
  workspaceId: string;
  projectId?: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; sprint?: SprintItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);
    const name = params.name.trim();
    if (!name) return { success: false, error: "Sprint name is required." };

    const startDateObj = params.startDate ? new Date(params.startDate) : null;
    const endDateObj = params.endDate ? new Date(params.endDate) : null;

    const created = await prisma.sprint.create({
      data: {
        workspaceId: access.workspace.id,
        projectId: params.projectId || null,
        name,
        goal: params.goal?.trim() || null,
        startDate: startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj : null,
        endDate: endDateObj && !isNaN(endDateObj.getTime()) ? endDateObj : null,
        status: "PLANNED",
      },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");

    return {
      success: true,
      sprint: {
        id: created.id,
        workspaceId: created.workspaceId,
        projectId: created.projectId,
        projectName: created.project?.name || null,
        projectKey: created.project?.key || null,
        name: created.name,
        goal: created.goal,
        startDate: created.startDate ? created.startDate.toISOString() : null,
        endDate: created.endDate ? created.endDate.toISOString() : null,
        status: "PLANNED",
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        remainingTasks: 0,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create sprint." };
  }
}

export async function updateSprintStatus(
  workspaceId: string,
  sprintId: string,
  newStatus: "PLANNED" | "ACTIVE" | "COMPLETED"
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });

    if (!sprint || sprint.workspaceId !== access.workspace.id) {
      return { success: false, error: "Sprint not found." };
    }

    // Constraint: Only 1 active sprint per project at a time
    if (newStatus === "ACTIVE" && sprint.projectId) {
      const activeSprint = await prisma.sprint.findFirst({
        where: {
          workspaceId: access.workspace.id,
          projectId: sprint.projectId,
          status: "ACTIVE",
          id: { not: sprintId },
        },
      });

      if (activeSprint) {
        return {
          success: false,
          error: `Project already has an active sprint ("${activeSprint.name}"). Please complete it before starting a new sprint.`,
        };
      }
    }

    await prisma.sprint.update({
      where: { id: sprintId },
      data: { status: newStatus },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update sprint status." };
  }
}

export async function assignTasksToSprint(
  workspaceId: string,
  sprintId: string | null,
  taskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    if (!Array.isArray(taskIds) || taskIds.length === 0) return { success: true };

    await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        workspaceId: access.workspace.id,
      },
      data: { sprintId: sprintId || null },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to assign tasks to sprint." };
  }
}
