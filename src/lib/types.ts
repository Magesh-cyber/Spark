export type WorkspaceType = "personal" | "organization" | "PERSONAL" | "ORGANIZATION";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  role: WorkspaceRole | "owner" | "admin" | "member" | "viewer";
  avatar?: string;
  avatarUrl?: string | null;
  description?: string | null;
  memberCount?: number;
  joinCode?: string | null;
  isPrivate?: boolean;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceMemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  };
}

export interface WorkspaceInvitationItem {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  inviter?: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface WorkspaceSettingsItem {
  id: string;
  workspaceId: string;
  defaultMemberRole: WorkspaceRole;
  allowMemberInvitations: boolean;
  allowGuestAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  title?: string;
  role: string;
}

export interface NavItem {
  id: string;
  title: string;
  href: string;
  iconName: string;
  badge?: string | number;
  badgeVariant?: "default" | "subtle" | "warning";
}

export type NotificationType =
  | "CHAT_DM"
  | "CHAT_CHANNEL"
  | "WORKSPACE_INVITATION"
  | "WORKSPACE_JOIN_REQUEST"
  | "MEMBER_JOINED"
  | "MEETING_SCHEDULED"
  | "TASK_ASSIGNED"
  | "TASK_DEADLINE"
  | "CALENDAR_EVENT"
  | "SYSTEM"
  | "mention"
  | "task"
  | "meeting"
  | "system";

export interface NotificationItem {
  id: string;
  userId?: string;
  workspaceId?: string | null;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: NotificationType;
  link?: string;
  metadata?: Record<string, any> | null;
}

export interface WorkspaceJoinRequestItem {
  id: string;
  workspaceId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  };
}
