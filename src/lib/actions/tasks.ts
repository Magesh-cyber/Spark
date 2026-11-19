"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import { createNotification } from "@/lib/actions/notifications";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export interface TaskRecordItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeAvatar: string | null;
  createdById: string;
  creatorName: string;
  createdAt: string;
}

export async function getWorkspaceTasks(
  workspaceId: string
): Promise<{ success: boolean; tasks: TaskRecordItem[]; error?: string }> {
  if (!workspaceId || workspaceId === "personal-fallback") {
    return { success: true, tasks: [] };
  }

  try {
    const access = await verifyWorkspaceAccess(workspaceId);

    const rows = await prisma.task.findMany({
      where: {
        workspaceId: access.workspace.id,
      },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const tasks: TaskRecordItem[] = rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      assigneeId: r.assigneeId,
      assigneeName: r.assignee?.fullName || null,
      assigneeEmail: r.assignee?.email || null,
      assigneeAvatar: r.assignee?.avatarUrl || null,
      createdById: r.createdById,
      creatorName: r.creator.fullName,
      createdAt: r.createdAt.toISOString(),
    }));

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

    const created = await prisma.task.create({
      data: {
        workspaceId: access.workspace.id,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        status: (params.status as TaskStatus) || "TODO",
        priority: (params.priority as TaskPriority) || "MEDIUM",
        dueDate: dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj : null,
        assigneeId: params.assigneeId || null,
        createdById: access.user.id,
      },
      include: {
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
        title: `Task Assigned: "${created.title}"`,
        message: `${created.creator.fullName} assigned you a task in ${access.workspace.name}: "${created.title}".`,
        link: "/tasks",
        metadata: {
          taskId: created.id,
          priority: created.priority,
          dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        },
      });
    }

    revalidatePath("/tasks");

    return {
      success: true,
      task: {
        id: created.id,
        workspaceId: created.workspaceId,
        title: created.title,
        description: created.description,
        status: created.status,
        priority: created.priority,
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        assigneeId: created.assigneeId,
        assigneeName: created.assignee?.fullName || null,
        assigneeEmail: created.assignee?.email || null,
        assigneeAvatar: created.assignee?.avatarUrl || null,
        createdById: created.createdById,
        creatorName: created.creator.fullName,
        createdAt: created.createdAt.toISOString(),
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update task status" };
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete task" };
  }
}
