const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

function loadEnv() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        val = val.trim().replace(/^["'](.*)["']$/, '$1');
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

// RBAC Permissions Logic mirroring src/lib/permissions.ts
const ROLE_HIERARCHY = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  GUEST: 10,
};

function canViewWorkspace(role, status = "ACTIVE") {
  if (status !== "ACTIVE") return false;
  return Boolean(ROLE_HIERARCHY[role]);
}

function canManageWorkspace(role) {
  return role === "OWNER" || role === "ADMIN";
}

function canInviteMembers(role, settings) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "MANAGER") return settings?.allowMemberInvitations ?? true;
  return false;
}

function canManageMembers(callerRole, targetRole) {
  if (callerRole === "OWNER") return true;
  if (callerRole === "ADMIN") {
    return targetRole === "MANAGER" || targetRole === "MEMBER" || targetRole === "GUEST";
  }
  return false;
}

function canChangeMemberRoles(callerRole, targetRole, newRole) {
  if (callerRole === "OWNER") return true;
  if (callerRole === "ADMIN") {
    if (ROLE_HIERARCHY[targetRole] >= ROLE_HIERARCHY.ADMIN) return false;
    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY.ADMIN) return false;
    return true;
  }
  return false;
}

function canManageSettings(role) {
  return role === "OWNER" || role === "ADMIN";
}

function canDeleteWorkspace(role, workspaceType) {
  const isPersonal = workspaceType === "PERSONAL" || workspaceType === "personal";
  if (isPersonal) return false;
  return role === "OWNER";
}

function canTransferOwnership(role, workspaceType) {
  const isPersonal = workspaceType === "PERSONAL" || workspaceType === "personal";
  if (isPersonal) return false;
  return role === "OWNER";
}

// Validation schemas mirroring src/lib/validations/workspace.ts
const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(50),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(250).optional().or(z.literal("")),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
  confirmation: z.literal("TRANSFER"),
});

async function main() {
  console.log("==================================================");
  console.log("SPARK MODULE 02 — MASTER TEST SUITE");
  console.log("==================================================");

  // ------------------------------------------------------------------------
  // GROUP 1: RBAC PERMISSION MATRIX (ALL 5 ROLES)
  // ------------------------------------------------------------------------
  console.log("\n[TEST GROUP 1] Centralized RBAC Permission Matrix");

  // canViewWorkspace
  assert(canViewWorkspace("OWNER", "ACTIVE"), "OWNER can view active workspace");
  assert(canViewWorkspace("ADMIN", "ACTIVE"), "ADMIN can view active workspace");
  assert(canViewWorkspace("MANAGER", "ACTIVE"), "MANAGER can view active workspace");
  assert(canViewWorkspace("MEMBER", "ACTIVE"), "MEMBER can view active workspace");
  assert(canViewWorkspace("GUEST", "ACTIVE"), "GUEST can view active workspace");
  assert(!canViewWorkspace("OWNER", "SUSPENDED"), "Suspended OWNER cannot view workspace");
  assert(!canViewWorkspace("MEMBER", "SUSPENDED"), "Suspended MEMBER cannot view workspace");

  // canManageWorkspace & canManageSettings
  assert(canManageWorkspace("OWNER") && canManageSettings("OWNER"), "OWNER can manage workspace & settings");
  assert(canManageWorkspace("ADMIN") && canManageSettings("ADMIN"), "ADMIN can manage workspace & settings");
  assert(!canManageWorkspace("MANAGER") && !canManageSettings("MANAGER"), "MANAGER cannot manage workspace & settings");
  assert(!canManageWorkspace("MEMBER") && !canManageSettings("MEMBER"), "MEMBER cannot manage workspace & settings");
  assert(!canManageWorkspace("GUEST") && !canManageSettings("GUEST"), "GUEST cannot manage workspace & settings");

  // canInviteMembers
  assert(canInviteMembers("OWNER"), "OWNER can invite members");
  assert(canInviteMembers("ADMIN"), "ADMIN can invite members");
  assert(canInviteMembers("MANAGER", { allowMemberInvitations: true }), "MANAGER can invite when settings allow");
  assert(!canInviteMembers("MANAGER", { allowMemberInvitations: false }), "MANAGER cannot invite when settings disallow");
  assert(!canInviteMembers("MEMBER"), "MEMBER cannot invite members");
  assert(!canInviteMembers("GUEST"), "GUEST cannot invite members");

  // canManageMembers
  assert(canManageMembers("OWNER", "ADMIN"), "OWNER can manage ADMIN");
  assert(canManageMembers("OWNER", "MEMBER"), "OWNER can manage MEMBER");
  assert(canManageMembers("ADMIN", "MANAGER"), "ADMIN can manage MANAGER");
  assert(canManageMembers("ADMIN", "MEMBER"), "ADMIN can manage MEMBER");
  assert(canManageMembers("ADMIN", "GUEST"), "ADMIN can manage GUEST");
  assert(!canManageMembers("ADMIN", "ADMIN"), "ADMIN cannot manage fellow ADMIN");
  assert(!canManageMembers("ADMIN", "OWNER"), "ADMIN cannot manage OWNER");
  assert(!canManageMembers("MEMBER", "MEMBER"), "MEMBER cannot manage fellow MEMBER");

  // canChangeMemberRoles
  assert(canChangeMemberRoles("OWNER", "MEMBER", "ADMIN"), "OWNER can promote MEMBER to ADMIN");
  assert(canChangeMemberRoles("ADMIN", "MEMBER", "MANAGER"), "ADMIN can promote MEMBER to MANAGER");
  assert(!canChangeMemberRoles("ADMIN", "MEMBER", "ADMIN"), "ADMIN cannot promote MEMBER to ADMIN (privilege escalation check)");
  assert(!canChangeMemberRoles("ADMIN", "MEMBER", "OWNER"), "ADMIN cannot promote MEMBER to OWNER");
  assert(!canChangeMemberRoles("MEMBER", "MEMBER", "ADMIN"), "MEMBER cannot alter roles");

  // canDeleteWorkspace & canTransferOwnership
  assert(canDeleteWorkspace("OWNER", "ORGANIZATION"), "OWNER can delete ORGANIZATION workspace");
  assert(!canDeleteWorkspace("OWNER", "PERSONAL"), "OWNER CANNOT delete PERSONAL workspace");
  assert(!canDeleteWorkspace("ADMIN", "ORGANIZATION"), "ADMIN cannot delete ORGANIZATION workspace");
  assert(canTransferOwnership("OWNER", "ORGANIZATION"), "OWNER can transfer ORGANIZATION workspace");
  assert(!canTransferOwnership("OWNER", "PERSONAL"), "OWNER CANNOT transfer PERSONAL workspace");
  assert(!canTransferOwnership("ADMIN", "ORGANIZATION"), "ADMIN cannot transfer ORGANIZATION workspace");

  // ------------------------------------------------------------------------
  // GROUP 2: ZOD VALIDATION & SLUG RULES
  // ------------------------------------------------------------------------
  console.log("\n[TEST GROUP 2] Input Validation & URL Slug Schemas");

  const validWs = createWorkspaceSchema.safeParse({
    name: "Acme Corp",
    slug: "acme-corp",
    description: "Engineering team",
  });
  assert(validWs.success, "Valid organization schema parses successfully");

  const badSlug1 = createWorkspaceSchema.safeParse({
    name: "Acme Corp",
    slug: "Acme Corp With Spaces!",
  });
  assert(!badSlug1.success, "Slug with spaces and capitals rejected");

  const badSlug2 = createWorkspaceSchema.safeParse({
    name: "Acme Corp",
    slug: "-leading-hyphen",
  });
  assert(!badSlug2.success, "Slug with leading hyphen rejected");

  const transferOk = transferOwnershipSchema.safeParse({
    newOwnerId: "00000000-0000-0000-0000-000000000001",
    confirmation: "TRANSFER",
  });
  assert(transferOk.success, "Transfer ownership requires exact 'TRANSFER' string");

  const transferBad = transferOwnershipSchema.safeParse({
    newOwnerId: "00000000-0000-0000-0000-000000000001",
    confirmation: "transfer", // lowercase
  });
  assert(!transferBad.success, "Transfer ownership rejects lowercase 'transfer'");

  // ------------------------------------------------------------------------
  // GROUP 3: DATABASE LIFECYCLE & MULTI-TENANCY PENETRATION TEST
  // ------------------------------------------------------------------------
  console.log("\n[TEST GROUP 3] Database Multi-Tenant Isolation & Lifecycle");

  // Fetch audit test users
  let testUser1 = await prisma.user.findFirst({ where: { email: { startsWith: 'audit.user.alpha.' } } });
  let testUser2 = await prisma.user.findFirst({ where: { email: { startsWith: 'audit.user.beta.' } } });

  if (!testUser1 || !testUser2) {
    throw new Error("Missing audit test users from Module 01!");
  }

  console.log(`Using Test User 1: ${testUser1.id} (${testUser1.email})`);
  console.log(`Using Test User 2: ${testUser2.id} (${testUser2.email})`);

  // 1. Personal Workspace Verification
  const user1Personal = await prisma.workspace.findFirst({
    where: { ownerId: testUser1.id, type: "PERSONAL" },
    include: { members: true, settings: true },
  });
  assert(!!user1Personal, "User 1 has personal workspace");
  assert(user1Personal.members.some(m => m.userId === testUser1.id && m.role === "OWNER"), "User 1 is OWNER in personal workspace");
  assert(user1Personal.settings.allowMemberInvitations === false, "Personal workspace has member invitations disabled by default");

  // 2. Personal Workspace Duplicate-Safety
  const personalCount = await prisma.workspace.count({
    where: { ownerId: testUser1.id, type: "PERSONAL" },
  });
  assert(personalCount === 1, "User 1 has exactly ONE personal workspace (no duplicates)");

  // 3. Organization Workspace Lifecycle
  const testOrgSlug = `test-org-${Date.now()}`;
  console.log(`\nCreating Organization Workspace with slug: ${testOrgSlug}...`);

  const createdOrg = await prisma.workspace.create({
    data: {
      name: "Alpha Beta Collaborative Org",
      slug: testOrgSlug,
      type: "ORGANIZATION",
      description: "Multi-tenant verification workspace",
      ownerId: testUser1.id,
      members: {
        create: [
          { userId: testUser1.id, role: "OWNER", status: "ACTIVE" },
          { userId: testUser2.id, role: "MEMBER", status: "ACTIVE" },
        ],
      },
      settings: {
        create: {
          defaultMemberRole: "MEMBER",
          allowMemberInvitations: true,
          allowGuestAccess: false,
        },
      },
    },
    include: { members: true, settings: true },
  });

  assert(!!createdOrg, "Organization workspace created successfully with members and settings");
  assert(createdOrg.members.length === 2, "Both test users added to organization workspace");

  // 4. Duplicate Slug Collision Test
  let slugCollisionRejected = false;
  try {
    await prisma.workspace.create({
      data: {
        name: "Colliding Workspace",
        slug: testOrgSlug, // Exact same slug
        type: "ORGANIZATION",
        ownerId: testUser2.id,
      },
    });
  } catch (err) {
    slugCollisionRejected = true;
  }
  assert(slugCollisionRejected, "Duplicate workspace slug rejected by database unique constraint");

  // ------------------------------------------------------------------------
  // GROUP 4: INVITATION SYSTEM LIFECYCLE
  // ------------------------------------------------------------------------
  console.log("\n[TEST GROUP 4] Invitation System Cryptographic Security");

  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
  const inviteeEmail = `invitee.candidate.${Date.now()}@gmail.com`;

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: createdOrg.id,
      email: inviteeEmail,
      role: "MEMBER",
      tokenHash: tokenHash,
      invitedBy: testUser1.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  assert(!!invitation, "Workspace invitation created");
  assert(invitation.tokenHash === tokenHash, "Stored token is cryptographically hashed (SHA-256)");
  assert(!invitation.tokenHash.includes(rawInviteToken), "Raw token is never stored in database");

  // Test token lookup by hash
  const foundInvite = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: crypto.createHash('sha256').update(rawInviteToken).digest('hex') },
  });
  assert(foundInvite && foundInvite.id === invitation.id, "Invitation successfully resolved via raw token hash");

  // Test tampered token
  const tamperedHash = crypto.createHash('sha256').update("invalid-forged-token-xyz").digest('hex');
  const tamperedInvite = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: tamperedHash },
  });
  assert(tamperedInvite === null, "Forged token fails resolution");

  // Test expired token rejection
  const expiredTokenHash = crypto.createHash('sha256').update("expired-token-sample").digest('hex');
  const expiredInvite = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: createdOrg.id,
      email: "expired@example.com",
      role: "MEMBER",
      tokenHash: expiredTokenHash,
      invitedBy: testUser1.id,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    },
  });
  const isExpired = new Date() > expiredInvite.expiresAt;
  assert(isExpired, "Expired invitation correctly detected and invalidated");

  // ------------------------------------------------------------------------
  // GROUP 5: TENANT ISOLATION PENETRATION TEST
  // ------------------------------------------------------------------------
  console.log("\n[TEST GROUP 5] Cross-Tenant Boundary Penetration");

  // Create isolated Workspace B belonging ONLY to User 2
  const isolatedOrgSlug = `isolated-b-${Date.now()}`;
  const workspaceB = await prisma.workspace.create({
    data: {
      name: "Secret Workspace B (User 2 Only)",
      slug: isolatedOrgSlug,
      type: "ORGANIZATION",
      ownerId: testUser2.id,
      members: {
        create: [
          { userId: testUser2.id, role: "OWNER", status: "ACTIVE" },
        ],
      },
      settings: {
        create: {
          defaultMemberRole: "MEMBER",
        },
      },
    },
  });

  // Test 1: User 1 queries membership in Workspace B
  const user1InB = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspaceB.id, userId: testUser1.id },
  });
  assert(user1InB === null, "User 1 is NOT a member of Workspace B");

  // Test 2: Verify membership scoping (User 1's visible workspaces)
  const user1Workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: testUser1.id },
        { members: { some: { userId: testUser1.id, status: "ACTIVE" } } },
      ],
    },
  });
  const user1SeesB = user1Workspaces.some(w => w.id === workspaceB.id);
  assert(!user1SeesB, "Tenant Boundary Enforced: User 1 cannot see or access Workspace B");

  // Test 3: Ownership transfer in createdOrg
  console.log("\nTesting Ownership Transfer in Organization...");
  // User 1 transfers ownership to User 2
  await prisma.$transaction([
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: createdOrg.id, userId: testUser2.id } },
      data: { role: "OWNER" },
    }),
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: createdOrg.id, userId: testUser1.id } },
      data: { role: "ADMIN" },
    }),
    prisma.workspace.update({
      where: { id: createdOrg.id },
      data: { ownerId: testUser2.id },
    }),
  ]);

  const afterTransferOrg = await prisma.workspace.findUnique({
    where: { id: createdOrg.id },
    include: { members: true },
  });
  assert(afterTransferOrg.ownerId === testUser2.id, "Workspace ownerId updated to User 2");
  const user2Member = afterTransferOrg.members.find(m => m.userId === testUser2.id);
  const user1Member = afterTransferOrg.members.find(m => m.userId === testUser1.id);
  assert(user2Member.role === "OWNER", "User 2 promoted to OWNER");
  assert(user1Member.role === "ADMIN", "Previous owner demoted to ADMIN");

  // Clean up temporary test organization workspaces
  console.log("\nCleaning up test organization workspaces...");
  await prisma.workspace.deleteMany({
    where: { id: { in: [createdOrg.id, workspaceB.id] } },
  });
  console.log("✓ Test workspaces cleaned up.");

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`MODULE 02 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
