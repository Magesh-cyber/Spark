const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: { workspace: true }
      }
    }
  });

  console.log(`Total users in DB: ${users.length}`);
  for (const u of users) {
    console.log(`\nUser: ${u.email} | ID: ${u.id} | Name: ${u.fullName}`);
    console.log(`  Memberships (${u.memberships.length}):`);
    for (const m of u.memberships) {
      console.log(`    - Workspace: ${m.workspace.name} (ID: ${m.workspace.id}, Type: ${m.workspace.type}) | Role: ${m.role} | Status: ${m.status}`);
    }
  }

  const sparkTeam = await prisma.workspace.findFirst({
    where: { name: 'SPARK Team' },
    include: {
      members: {
        include: { user: true }
      },
      channels: true
    }
  });

  if (sparkTeam) {
    console.log(`\nSPARK Team Workspace Members:`);
    for (const m of sparkTeam.members) {
      console.log(`  - ${m.user?.email} [${m.role}, ${m.status}]`);
    }
    console.log(`Channels:`);
    for (const c of sparkTeam.channels) {
      console.log(`  - #${c.name} (${c.nexconnChannelId})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

