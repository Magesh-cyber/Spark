import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { prisma } from "@/lib/prisma";
import { WorkspaceRole, WorkspaceType, MembershipStatus } from "./types";
import { ROLE_HIERARCHY } from "./permissions";

export interface WorkspaceAccessResult {
  user: {
    id: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: WorkspaceType;
    ownerId: string;
    avatarUrl: string | null;
  };
  member: {
    id: string;
    role: WorkspaceRole;
    status: MembershipStatus;
  };
  settings: {
    defaultMemberRole: WorkspaceRole;
    allowMemberInvitations: boolean;
    allowGuestAccess: boolean;
  };
}

export type AccessErrorReason =
  | "UNAUTHENTICATED"
  | "WORKSPACE_NOT_FOUND"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_SUSPENDED"
  | "INSUFFICIENT_PERMISSIONS";

export class WorkspaceAccessError extends Error {
  constructor(public reason: AccessErrorReason, message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

/**
 * Validates whether a string is a standard UUID.
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str
  );
}

/**
 * Server-side guard that verifies authenticated user identity, workspace existence,
 * active membership status, and RBAC authorization.
 */
export async function verifyWorkspaceAccess(
  workspaceIdOrSlug: string,
  minRole?: WorkspaceRole
): Promise<WorkspaceAccessResult> {
  // Fast fail on uninitialized client state
  if (!workspaceIdOrSlug || workspaceIdOrSlug === "personal-fallback") {
    throw new WorkspaceAccessError(
      "WORKSPACE_NOT_FOUND",
      "Workspace context is still loading."
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    throw new WorkspaceAccessError(
      "UNAUTHENTICATED",
      "Authentication required to access workspace."
    );
  }

  // 1. Resolve workspace by ID or Slug
  const isId = isUUID(workspaceIdOrSlug);
  const workspace = await prisma.workspace.findUnique({
    where: isId ? { id: workspaceIdOrSlug } : { slug: workspaceIdOrSlug },
    include: {
      settings: true,
      members: {
        where: { userId: user.id },
      },
    },
  });

  if (!workspace) {
    throw new WorkspaceAccessError(
      "WORKSPACE_NOT_FOUND",
      "The requested workspace does not exist or has been deleted."
    );
  }

  // 2. Resolve or heal membership
  let member = workspace.members[0];

  if (!member) {
    // If caller is the record owner, heal the missing membership row
    if (workspace.ownerId === user.id) {
      member = await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
    } else {
      throw new WorkspaceAccessError(
        "MEMBERSHIP_NOT_FOUND",
        "You are not a member of this workspace."
      );
    }
  }

  // 3. Check membership status
  if (member.status === "SUSPENDED") {
    throw new WorkspaceAccessError(
      "MEMBERSHIP_SUSPENDED",
      "Your membership in this workspace has been suspended. Please contact your workspace administrator."
    );
  }

  // 4. Check minimum role requirement if specified
  if (minRole) {
    const callerScore = ROLE_HIERARCHY[member.role as WorkspaceRole] ?? 0;
    const requiredScore = ROLE_HIERARCHY[minRole] ?? 0;
    if (callerScore < requiredScore) {
      throw new WorkspaceAccessError(
        "INSUFFICIENT_PERMISSIONS",
        `Insufficient permissions. Requires at least ${minRole} privileges.`
      );
    }
  }

  // 5. Ensure workspace settings exist
  let settings = workspace.settings;
  if (!settings) {
    settings = await prisma.workspaceSettings.create({
      data: {
        workspaceId: workspace.id,
        defaultMemberRole: "MEMBER",
        allowMemberInvitations: workspace.type === "ORGANIZATION",
        allowGuestAccess: false,
      },
    });
  }

  return {
    user: {
      id: user.id,
      email: user.email || "",
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      type: workspace.type as WorkspaceType,
      ownerId: workspace.ownerId,
      avatarUrl: workspace.avatarUrl,
    },
    member: {
      id: member.id,
      role: member.role as WorkspaceRole,
      status: member.status as MembershipStatus,
    },
    settings: {
      defaultMemberRole: settings.defaultMemberRole as WorkspaceRole,
      allowMemberInvitations: settings.allowMemberInvitations,
      allowGuestAccess: settings.allowGuestAccess,
    },
  };
}

