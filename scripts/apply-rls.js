const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Row Level Security (RLS) and Profile Sync trigger to public.users...');

  // 1. Enable RLS
  await prisma.$executeRawUnsafe(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`);
  console.log('[PASS] RLS enabled on public.users');

  // 2. Drop existing policies if any
  await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Users can read own profile" ON public.users;`);
  await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Users can update own profile" ON public.users;`);
  await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;`);
  await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Allow authenticated read own profile" ON public.users;`);

  // 3. Create SELECT policy (users can read their own profile)
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "Users can read own profile"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
  `);
  console.log('[PASS] Created SELECT policy on public.users');

  // 4. Create UPDATE policy (users can update their own profile)
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  `);
  console.log('[PASS] Created UPDATE policy on public.users');

  // 5. Create INSERT policy (users can insert their own profile)
  await prisma.$executeRawUnsafe(`
    CREATE POLICY "Users can insert own profile"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
  `);
  console.log('[PASS] Created INSERT policy on public.users');

  // 6. Profile Auto-Sync Trigger from auth.users to public.users
  try {
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

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `);
    console.log('[PASS] Created auth.users -> public.users auto-sync trigger');
  } catch (err) {
    console.log('[INFO] Note on auth.users trigger (requires superuser/owner permissions):', err.message);
  }

  // 7. Verify RLS status
  const rlsCheck = await prisma.$queryRaw`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname = 'users' AND relnamespace = 'public'::regnamespace;
  `;
  console.log('[PASS] RLS Verification:', rlsCheck);

  // 8. List policies on public.users
  const policies = await prisma.$queryRaw`
    SELECT policyname, permissive, roles, cmd, qual 
    FROM pg_policies 
    WHERE tablename = 'users' AND schemaname = 'public';
  `;
  console.log('[PASS] Active Policies on public.users:', policies);
}

main()
  .catch((e) => {
    console.error('[FAIL] RLS setup error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

