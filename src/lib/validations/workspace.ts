import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(50, "Workspace name cannot exceed 50 characters."),
  slug: z
    .string()
    .trim()
    .min(2, "Workspace slug must be at least 2 characters.")
    .max(50, "Workspace slug cannot exceed 50 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and single hyphens (e.g., 'acme-corp')."
    ),
  description: z
    .string()
    .trim()
    .max(250, "Description cannot exceed 250 characters.")
    .optional()
    .or(z.literal("")),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().or(z.literal("")),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(50, "Workspace name cannot exceed 50 characters."),
  description: z
    .string()
    .trim()
    .max(250, "Description cannot exceed 250 characters.")
    .optional()
    .or(z.literal("")),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().or(z.literal("")),
});

export const updateWorkspaceSettingsSchema = z.object({
  defaultMemberRole: z.enum(["MANAGER", "MEMBER", "GUEST"]),
  allowMemberInvitations: z.boolean(),
  allowGuestAccess: z.boolean(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Please enter a valid work email address."),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "GUEST"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "GUEST"]),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid("Invalid user ID."),
  confirmation: z.literal("TRANSFER", {
    errorMap: () => ({ message: "Please type 'TRANSFER' to confirm." }),
  }),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

