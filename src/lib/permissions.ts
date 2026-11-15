import { WorkspaceRole, WorkspaceType, MembershipStatus, WorkspaceSettingsItem } from "./types";

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  GUEST: 10,
};

/**
 * Checks if a user can view workspace resources.
 */
export function canViewWorkspace(
  role: WorkspaceRole,
  status: MembershipStatus = "ACTIVE"
): boolean {
  if (status !== "ACTIVE") return false;
  return Boolean(ROLE_HIERARCHY[role]);
}

/**
 * Checks if a user has general administrative rights in the workspace.
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Checks if a user can invite new members to the workspace.
 */
export function canInviteMembers(
  role: WorkspaceRole,
  settings?: { allowMemberInvitations?: boolean } | null
): boolean {
  if (role === "OWNER" || role === "ADMIN") {
    return true;
  }
  if (role === "MANAGER") {
    return settings?.allowMemberInvitations ?? true;
  }
  return false;
}

/**
 * Checks if a caller can manage (suspend, reactivate, or remove) a target member.
 * Rule: Caller must be ADMIN or OWNER, and caller role must outrank target role.
 */
export function canManageMembers(
  callerRole: WorkspaceRole,
  targetRole: WorkspaceRole
): boolean {
  if (callerRole === "OWNER") {
    // Owner can manage anyone except other owners (last-owner handled separately)
    return true;
  }
  if (callerRole === "ADMIN") {
    // Admin can manage MANAGER, MEMBER, GUEST, but NOT ADMIN or OWNER
    return (
      targetRole === "MANAGER" ||
      targetRole === "MEMBER" ||
      targetRole === "GUEST"
    );
  }
  return false;
}

/**
 * Checks if a caller can alter another member's role.
 * Rule: Caller must outrank target's current role AND the requested new role.
 */
export function canChangeMemberRoles(
  callerRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  newRole: WorkspaceRole
): boolean {
  if (callerRole === "OWNER") {
    // Owner can set any role except OWNER (OWNER changes require transferOwnership)
    return true;
  }
  if (callerRole === "ADMIN") {
    // Admin can only change roles for MANAGER, MEMBER, GUEST
    if (ROLE_HIERARCHY[targetRole] >= ROLE_HIERARCHY.ADMIN) {
      return false;
    }
    // Admin cannot promote anyone to ADMIN or OWNER
    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY.ADMIN) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Checks if a user can edit workspace configuration and security settings.
 */
export function canManageSettings(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Checks if a user can delete a workspace.
 * Personal workspaces can NEVER be deleted.
 * Organization workspaces can only be deleted by the OWNER.
 */
export function canDeleteWorkspace(
  role: WorkspaceRole,
  workspaceType: WorkspaceType | string
): boolean {
  const isPersonal =
    workspaceType === "PERSONAL" || workspaceType === "personal";
  if (isPersonal) return false;
  return role === "OWNER";
}

/**
 * Checks if a user can transfer workspace ownership.
 * Only the current OWNER can transfer ownership of an ORGANIZATION workspace.
 */
export function canTransferOwnership(
  role: WorkspaceRole,
  workspaceType: WorkspaceType | string
): boolean {
  const isPersonal =
    workspaceType === "PERSONAL" || workspaceType === "personal";
  if (isPersonal) return false;
  return role === "OWNER";
}

