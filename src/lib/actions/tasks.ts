"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { createNotification } from "@/lib/actions/notifications";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export type WorkItemType = "TASK" | "BUG" | "STORY" | "EPIC";

export interface TaskChecklistItemData {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
}

export interface TaskCommentData {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
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
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeAvatar: string | null;
  createdById: string;
  creatorName: string;
  createdAt: string;
  checklistTotal: number;
  checklistDone: number;
  commentsCount: number;
}

export async function getWorkspaceTasks(
  workspaceId: string
): Promise<{ success: boolean; tasks: TaskRecordItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, tasks: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const isElevated = access.member.role === "OWNER" || access.member.role === "ADMIN";

    const rows = await prisma.task.findMany({
      where: {
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
      },
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
        checklists: {
          select: { id: true, isCompleted: true },
        },
        _count: {
          select: { comments: true },
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
        status: r.status,
        priority: r.priority,
        storyPoints: r.storyPoints,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
        assigneeId: r.assigneeId,
        assigneeName: r.assignee?.fullName || null,
        assigneeEmail: r.assignee?.email || null,
        assigneeAvatar: r.assignee?.avatarUrl || null,
        createdById: r.createdById,
        creatorName: r.creator.fullName,
        createdAt: r.createdAt.toISOString(),
        checklistTotal,
        checklistDone,
        commentsCount: r._count?.comments || 0,
      };
    });

    return { success: true, tasks };
  } catch (err: any) {
    return { success: false, tasks: [], error: err?.message || "Failed to load tasks" };
  }
}

export async function createWorkspaceTask(params: {
  workspaceId: string;
  title: string;
  description?: string;
  status?: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  type?: WorkItemType;
  storyPoints?: number;
  projectId?: string;
  dueDate?: string;
  assigneeId?: string;
}): Promise<{ success: boolean; task?: TaskRecordItem; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(params.workspaceId);

    if (!params.title || !params.title.trim()) {
      return { success: false, error: "Task title is required." };
    }

    const dueDateObj = params.dueDate ? new Date(params.dueDate) : null;

    // Verify assignee belongs to this workspace if specified
    if (params.assigneeId) {
      const isMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: access.workspace.id,
          userId: params.assigneeId,
          status: "ACTIVE",
        },
      });

      if (!isMember) {
        return { success: false, error: "Assignee is not an active member of this workspace." };
      }
    }

    // Auto-derive Issue Key (e.g. SPK-14 or CORE-7)
    let issueKey: string | null = null;
    let projectKeyPrefix = "SPK";
    if (params.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        select: { key: true },
      });
      if (project?.key) {
        projectKeyPrefix = project.key;
      }
    }

    const taskCount = await prisma.task.count({
      where: {
        workspaceId: access.workspace.id,
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
    });
    issueKey = `${projectKeyPrefix}-${taskCount + 1}`;

    const created = await prisma.task.create({
      data: {
        workspaceId: access.workspace.id,
        projectId: params.projectId || null,
        issueKey,
        type: params.type || "TASK",
        title: params.title.trim(),
        description: params.description?.trim() || null,
        status: (params.status as TaskStatus) || "TODO",
        priority: (params.priority as TaskPriority) || "MEDIUM",
        storyPoints: params.storyPoints ? Number(params.storyPoints) : null,
        dueDate: dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj : null,
        assigneeId: params.assigneeId || null,
        createdById: access.user.id,
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
      },
    });

    // Send real notification to assignee if assigned to someone else
    if (created.assigneeId && created.assigneeId !== access.user.id) {
      await createNotification({
        userId: created.assigneeId,
        workspaceId: access.workspace.id,
        type: "TASK_ASSIGNED",
        title: `Task Assigned: [${created.issueKey || "Task"}] ${created.title}`,
        message: `${created.creator.fullName} assigned you an issue in ${access.workspace.name}: "${created.title}".`,
        link: "/tasks",
        metadata: {
          taskId: created.id,
          issueKey: created.issueKey,
          priority: created.priority,
          dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/projects");

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
        status: created.status,
        priority: created.priority,
        storyPoints: created.storyPoints,
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        assigneeId: created.assigneeId,
        assigneeName: created.assignee?.fullName || null,
        assigneeEmail: created.assignee?.email || null,
        assigneeAvatar: created.assignee?.avatarUrl || null,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        createdAt: created.createdAt.toISOString(),
        checklistTotal: 0,
        checklistDone: 0,
        commentsCount: 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create task" };
  }
}

export async function updateTaskStatus(
  workspaceId: string,
  taskId: string,
  newStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found in this workspace." };
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus as TaskStatus },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update task status" };
  }
}

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
    dueDate?: string | null;
    assigneeId?: string | null;
    projectId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found in this workspace." };
    }

    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status as TaskStatus;
    if (data.priority !== undefined) updatePayload.priority = data.priority as TaskPriority;
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.storyPoints !== undefined) updatePayload.storyPoints = data.storyPoints;
    if (data.dueDate !== undefined) {
      updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.assigneeId !== undefined) updatePayload.assigneeId = data.assigneeId || null;
    if (data.projectId !== undefined) updatePayload.projectId = data.projectId || null;

    await prisma.task.update({
      where: { id: taskId },
      data: updatePayload,
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update task." };
  }
}

export async function deleteTask(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found in this workspace." };
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete task" };
  }
}

// ================= Checklist / Subtask Actions =================

export async function getTaskChecklist(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; items: TaskChecklistItemData[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, items: [], error: "Task not found." };
    }

    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId },
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

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Task not found." };
    }

    const count = await prisma.taskChecklistItem.count({ where: { taskId } });

    const created = await prisma.taskChecklistItem.create({
      data: {
        taskId,
        title: title.trim(),
        position: count,
        isCompleted: false,
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
    const access = await verifyWorkspaceAccess(workspaceId);

    const item = await prisma.taskChecklistItem.findUnique({
      where: { id: itemId },
      include: { task: true },
    });

    if (!item || item.task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Checklist item not found." };
    }

    await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { isCompleted },
    });

    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update checklist item." };
  }
}

export async function deleteTaskChecklistItem(
  workspaceId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const item = await prisma.taskChecklistItem.findUnique({
      where: { id: itemId },
      include: { task: true },
    });

    if (!item || item.task.workspaceId !== access.workspace.id) {
      return { success: false, error: "Checklist item not found." };
    }

    await prisma.taskChecklistItem.delete({ where: { id: itemId } });

    revalidatePath("/tasks");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete checklist item." };
  }
}

// ================= Task Comments / Discussion =================

export async function getTaskComments(
  workspaceId: string,
  taskId: string
): Promise<{ success: boolean; comments: TaskCommentData[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.workspaceId !== access.workspace.id) {
      return { success: false, comments: [], error: "Task not found." };
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        userName: c.user?.fullName || "Team Member",
        userAvatar: c.user?.avatarUrl || null,
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

    if (!content || !content.trim()) {
      return { success: false, error: "Comment text cannot be empty." };
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { creator: true },
    });

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

    // Notify task assignee if commenter is not assignee
    if (task.assigneeId && task.assigneeId !== access.user.id) {
      await createNotification({
        userId: task.assigneeId,
        workspaceId: access.workspace.id,
        type: "TASK_ASSIGNED",
        title: `New Comment on [${task.issueKey || "Task"}] ${task.title}`,
        message: `${created.user.fullName} commented: "${content.trim().slice(0, 80)}"`,
        link: "/tasks",
        metadata: {
          taskId: task.id,
          commentId: created.id,
        },
      });
    }

    revalidatePath("/tasks");
    return {
      success: true,
      comment: {
        id: created.id,
        taskId: created.taskId,
        userId: created.userId,
        userName: created.user.fullName,
        userAvatar: created.user.avatarUrl || null,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to post comment." };
  }
}
