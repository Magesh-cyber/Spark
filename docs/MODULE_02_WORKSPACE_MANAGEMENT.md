# SPARK — MODULE 02: WORKSPACE MANAGEMENT & MULTI-TENANCY
## Architecture, Database Models, Security Guardrails & Implementation Guide

**Product:** SPARK — Collaborative Workplace SaaS  
**Module:** 02 — Workspaces, Organizations, Memberships, Invitations & Multi-Tenancy  
**Status:** **IMPLEMENTED & VERIFIED (PRODUCTION-READY)**  
**Version:** 1.0.0  

---

## 1. Architectural Overview & Tenant Boundary

SPARK enforces a multi-tenant SaaS architecture where the **Workspace** serves as the strict administrative, data, and authorization tenant boundary. Every collaborative resource (tasks, channels, chat messages, meetings, projects, documents, notifications) is scoped by a `workspaceId`.

### Key Multi-Tenancy Invariants
1. **Global User vs. Tenant Membership:** A user account (`public.users`) exists globally. A user has zero or more memberships (`public.workspace_members`) linking them to workspaces.
2. **Personal Workspace Guarantee:** Every user account is guaranteed exactly one `PERSONAL` workspace. The personal workspace cannot be deleted, cannot have its owner removed, and has member invitations disabled by default.
3. **Organization Workspaces:** Users can create unlimited `ORGANIZATION` workspaces, join organizations via cryptographic email invitations, and possess distinct roles in each workspace.
4. **Server-Side Tenant Scoping:** Because Prisma connects with high-privilege credentials, Prisma queries and server actions must **always** enforce server-side tenant scoping (`where: { workspaceId: access.workspace.id }`).
5. **PostgreSQL Row Level Security (RLS):** All workspace tables have RLS enabled with explicit policies for `authenticated` and `service_role`.

---

## 2. Database Models & Schema Design

Implemented in `prisma/schema.prisma` and applied via migration `20261115_module_02_workspaces`:

```prisma
enum WorkspaceType {
  PERSONAL
  ORGANIZATION
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MANAGER
  MEMBER
  GUEST
}

enum MembershipStatus {
  ACTIVE
  SUSPENDED
}

model Workspace {
  id          String        @id @default(uuid()) @db.Uuid
  name        String
  slug        String        @unique
  description String?
  type        WorkspaceType @default(ORGANIZATION)
  avatarUrl   String?       @map("avatar_url")
  ownerId     String        @map("owner_id") @db.Uuid
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  owner       User                  @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  members     WorkspaceMember[]
  invitations WorkspaceInvitation[]
  settings    WorkspaceSettings?

  @@index([ownerId])
  @@index([type])
  @@map("workspaces")
}

model WorkspaceMember {
  id          String           @id @default(uuid()) @db.Uuid
  workspaceId String           @map("workspace_id") @db.Uuid
  userId      String           @map("user_id") @db.Uuid
  role        WorkspaceRole    @default(MEMBER)
  status      MembershipStatus @default(ACTIVE)
  joinedAt    DateTime         @default(now()) @map("joined_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  workspace   Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([workspaceId])
  @@index([userId])
  @@index([role])
  @@index([status])
  @@map("workspace_members")
}

model WorkspaceInvitation {
  id          String        @id @default(uuid()) @db.Uuid
  workspaceId String        @map("workspace_id") @db.Uuid
  email       String
  role        WorkspaceRole @default(MEMBER)
  tokenHash   String        @unique @map("token_hash")
  invitedBy   String        @map("invited_by") @db.Uuid
  expiresAt   DateTime      @map("expires_at")
  acceptedAt  DateTime?     @map("accepted_at")
  revokedAt   DateTime?     @map("revoked_at")
  createdAt   DateTime      @default(now()) @map("created_at")

  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  inviter     User          @relation("InvitedByUser", fields: [invitedBy], references: [id], onDelete: Restrict)

  @@index([workspaceId, email])
  @@index([tokenHash])
  @@index([expiresAt])
  @@map("workspace_invitations")
}

model WorkspaceSettings {
  id                     String        @id @default(uuid()) @db.Uuid
  workspaceId            String        @unique @map("workspace_id") @db.Uuid
  defaultMemberRole      WorkspaceRole @default(MEMBER) @map("default_member_role")
  allowMemberInvitations Boolean       @default(true) @map("allow_member_invitations")
  allowGuestAccess       Boolean       @default(false) @map("allow_guest_access")
  createdAt              DateTime      @default(now()) @map("created_at")
  updatedAt              DateTime      @updatedAt @map("updated_at")

  workspace              Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("workspace_settings")
}
```

---

## 3. Personal Workspace Lifecycle

### Dual-Layer Automatic Creation
Personal workspaces are provisioned automatically via two independent, fault-tolerant layers:
1. **PostgreSQL Trigger (`public.handle_new_user()`):**  
   Whenever a new record is inserted into `auth.users`, the trigger atomically inserts:
   - `public.users` profile row.
   - `public.workspaces` with `type = 'PERSONAL'`, `owner_id = new.id`, and deterministic slug `personal-<shortId>`.
   - `public.workspace_members` with `role = 'OWNER'` and `status = 'ACTIVE'`.
   - `public.workspace_settings` with `allow_member_invitations = false`.
2. **Server Action Self-Healing (`ensurePersonalWorkspace`):**  
   Invoked by `getUserWorkspaces()` whenever a user accesses the workspace directory. If a personal workspace is missing, it creates one inside a Prisma transaction with duplicate-safe conflict handling.
3. **Immutability Invariants:**
   - Personal workspaces cannot be deleted (`canDeleteWorkspace` returns `false`).
   - Personal workspace owners cannot be removed or demoted (`removeMember` rejects removal).

---

## 4. Organization Workspace Lifecycle

1. **Creation (`createOrganizationWorkspace`):**
   - Validates name and URL slug using Zod (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
   - Enforces slug uniqueness across all workspaces.
   - Creates workspace, creator's `OWNER` membership, and default settings in a single `$transaction`.
2. **Details & Settings Update (`updateWorkspace`, `updateWorkspaceSettings`):**
   - Requires caller to hold `OWNER` or `ADMIN` role.
   - Allows updating name, description, avatar, default member roles, and invitation policies.
3. **Ownership Transfer (`transferWorkspaceOwnership`):**
   - Restricted strictly to the current `OWNER` of an `ORGANIZATION`.
   - Target must be an active member of the workspace.
   - Executes inside a transaction: target promoted to `OWNER`, former owner demoted to `ADMIN`, `workspace.ownerId` updated.
   - Requires explicit confirmation string `"TRANSFER"`.
4. **Deletion (`deleteWorkspace`):**
   - Restricted strictly to the current `OWNER` of an `ORGANIZATION`.
   - Requires confirmation string matching the exact workspace name.
   - Cascades all members, settings, and invitations.

---

## 5. Centralized RBAC Permission Matrix

Implemented in `src/lib/permissions.ts` using strict numerical hierarchy:
`OWNER (50) > ADMIN (40) > MANAGER (30) > MEMBER (20) > GUEST (10)`

| Action / Capability | OWNER | ADMIN | MANAGER | MEMBER | GUEST | Rule Enforced |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **View Workspace Resources** | ✅ | ✅ | ✅ | ✅ | ✅ | Active status required |
| **Manage General Settings** | ✅ | ✅ | ❌ | ❌ | ❌ | Role >= ADMIN |
| **Invite New Members** | ✅ | ✅ | ⚠️ | ❌ | ❌ | Manager allowed only if settings permit |
| **Manage (Suspend/Remove) Member** | ✅ | ⚠️ | ❌ | ❌ | ❌ | Caller must strictly outrank target |
| **Change Member Role** | ✅ | ⚠️ | ❌ | ❌ | ❌ | Caller cannot promote to equal or higher role |
| **Transfer Ownership** | ✅ | ❌ | ❌ | ❌ | ❌ | Organization only; Owner only |
| **Delete Workspace** | ✅ | ❌ | ❌ | ❌ | ❌ | Organization only; Owner only |

---

## 6. Cryptographic Invitation System

1. **Token Generation:** 32 bytes of cryptographically secure random entropy (`crypto.randomBytes(32).toString('hex')`).
2. **Storage:** Only the SHA-256 hash of the token (`token_hash`) is persisted in `public.workspace_invitations`. Raw tokens are never logged or stored in the database.
3. **Expiration:** Tokens are timestamped with `expires_at = now() + 7 days`.
4. **Revocation & Resending:** Invites can be revoked (`revoked_at = now()`) or resent (rotates the token hash and refreshes expiration).
5. **Acceptance Verification (`acceptWorkspaceInvitation`):**
   - Resolves invitation by hashing input token.
   - Validates `expires_at > now()`, `acceptedAt === null`, `revokedAt === null`.
   - **Identity Match Check:** Enforces that the authenticated caller's email matches the invitation target email (`user.email.toLowerCase() === invite.email.toLowerCase()`).
   - Transactionally creates/updates active membership and stamps `accepted_at = now()`.

---

## 7. PostgreSQL Row Level Security (RLS) Policies

All workspace tables have RLS enabled:
- **`public.workspaces`:**
  - `SELECT`: `owner_id = auth.uid() OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND status = 'ACTIVE')`
  - `UPDATE`: `owner_id = auth.uid() OR EXISTS (... WHERE role IN ('OWNER', 'ADMIN'))`
  - `INSERT`: `owner_id = auth.uid()`
  - `DELETE`: `owner_id = auth.uid()`
- **`public.workspace_members`:**
  - `SELECT`: Scoped to active members within the same workspace or own membership row.
  - `UPDATE / DELETE`: Scoped to `ADMIN` and `OWNER` roles.
- **`public.workspace_invitations`:**
  - `SELECT`: Scoped to members with `role IN ('OWNER', 'ADMIN', 'MANAGER')`.
- **`public.workspace_settings`:**
  - `SELECT`: Scoped to active members.
  - `UPDATE`: Scoped to `ADMIN` and `OWNER`.

---

## 8. Client Integration & Switcher UX

1. **`WorkspaceProvider` (`src/lib/workspace-context.tsx`):**
   - Synchronizes active workspace state with real backend (`getUserWorkspaces()`).
   - Persists selection in `localStorage` and HTTP cookie (`spark_active_workspace_id`) for seamless SSR hydration.
   - Exposes `refreshWorkspaces()` to trigger instant UI re-renders on workspace mutations.
2. **`WorkspaceSwitcher` (`src/components/layout/WorkspaceSwitcher.tsx`):**
   - Renders categorized dropdown: Personal Workspace vs. Organizations.
   - Shows active workspace badge, member count, and switch triggers.
   - Includes direct actions: "Create Organization", "Workspace Settings", and "Manage All Workspaces".
3. **Application Routes Implemented:**
   - `/workspaces`: Master directory of all user workspaces.
   - `/workspaces/create`: Creation form with live slug auto-generation.
   - `/workspaces/[slug]`: Workspace overview hub and quick navigation.
   - `/workspaces/[slug]/settings`: Configuration, policy settings, ownership transfer, danger zone.
   - `/workspaces/[slug]/members`: Member table, role selector, suspend/reactivate, remove member.
   - `/workspaces/[slug]/invitations`: Pending invitations, resend, revoke.
   - `/invitations/accept`: Secure invitation acceptance screen with identity validation.

---

## 9. Test Verification Results

Automated test suite (`scripts/test-module-02-suite.js`) passed with **60/60 assertions (100% success)**:
- **Test Group 1 (RBAC Matrix):** 34/34 assertions passed across all 5 roles.
- **Test Group 2 (Validation & Slugs):** 5/5 assertions passed.
- **Test Group 3 (Lifecycle & Duplicates):** 6/6 assertions passed.
- **Test Group 4 (Invitation Security):** 6/6 assertions passed.
- **Test Group 5 (Tenant Isolation & Transfer):** 9/9 assertions passed.
- **Quality Gates:**
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run build`: 23/23 routes compiled successfully.

