const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Installing auth.users -> public.users trigger...');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.users (id, email, full_name, created_at, updated_at)
      VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE 
          WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name 
          ELSE public.users.full_name 
        END,
        updated_at = now();
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('[PASS] Created public.handle_new_user() function');

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  `);
  console.log('[PASS] Attached on_auth_user_created trigger to auth.users');
}

main()
  .catch((e) => {
    console.error('[FAIL] Trigger setup error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

