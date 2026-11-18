const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, createdAt: true }
  });
  console.log(`--- USERS (${users.length}) ---`);
  for (const u of users) {
    console.log(`User: ${u.id} | ${u.email} | ${u.fullName}`);
  }

  const workspaces = await prisma.workspace.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, email: true, fullName: true } } }
      },
      channels: true
    }
  });
  console.log(`\n--- WORKSPACES (${workspaces.length}) ---`);
  for (const w of workspaces) {
    console.log(`Workspace: ${w.name} (ID: ${w.id}, Type: ${w.type})`);
    console.log(`  Members (${w.members.length}): ${w.members.map(m => (m.user ? m.user.email : 'Unknown') + ' [' + m.role + ']').join(', ')}`);
    console.log(`  Channels (${w.channels.length}): ${w.channels.map(c => '#' + c.name + ' [' + c.nexconnChannelId + ']').join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

