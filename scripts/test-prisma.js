const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma PostgreSQL connectivity and query...');
  const result = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users';
  `;
  console.log('[PASS] Query result for public.users table:', result);

  const count = await prisma.user.count();
  console.log('[PASS] prisma.user.count():', count);

  const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_user;`;
  console.log('[PASS] Connected to DB:', dbInfo[0].current_database, 'as User:', dbInfo[0].current_user);
}

main()
  .catch((e) => {
    console.error('[FAIL] Prisma query error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

