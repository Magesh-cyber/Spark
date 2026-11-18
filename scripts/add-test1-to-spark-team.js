const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workspaceId = '35c436f1-4879-40a2-97f2-256534d44533'; // SPARK Team
  const userId = '9a10bc03-d539-4933-a64e-b22f75e43197'; // test1@gmail.com

  const existing = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (existing) {
    console.log('test1 is already a member of SPARK Team:', existing.role, existing.status);
    return;
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  console.log('Successfully added test1@gmail.com to SPARK Team as MEMBER:', member.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

