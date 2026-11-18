const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workspaceId = '35c436f1-4879-40a2-97f2-256534d44533'; // SPARK Team
  const userId = '4854ec97-7917-4fc4-b7ac-2327bb184828'; // Magesh

  const existing = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (existing) {
    console.log('Magesh is already a member of SPARK Team:', existing.role, existing.status);
    return;
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Successfully added Magesh to SPARK Team as ADMIN:', member.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

