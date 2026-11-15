const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      let val = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      process.env[match[1]] = val;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const statements = [
  // 1. Enum
  `DO $$ BEGIN
      CREATE TYPE "ChatChannelType" AS ENUM ('PUBLIC', 'PRIVATE');
  EXCEPTION
      WHEN duplicate_object THEN null;
  END $$;`,

  // 2. workspace_chat_channels
  `CREATE TABLE IF NOT EXISTS public.workspace_chat_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      nexconn_channel_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      type "ChatChannelType" NOT NULL DEFAULT 'PUBLIC',
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_workspace_channel_name UNIQUE (workspace_id, name)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_chat_channels_workspace_id ON public.workspace_chat_channels(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_chat_channels_nexconn_id ON public.workspace_chat_channels(nexconn_channel_id);`,

  // 3. chat_channel_members
  `CREATE TABLE IF NOT EXISTS public.chat_channel_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES public.workspace_chat_channels(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_chat_channel_member UNIQUE (channel_id, user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON public.chat_channel_members(channel_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON public.chat_channel_members(user_id);`,

  // 4. chat_direct_conversations
  `CREATE TABLE IF NOT EXISTS public.chat_direct_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_chat_direct_conversation UNIQUE (workspace_id, user1_id, user2_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_workspace_id ON public.chat_direct_conversations(workspace_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_user1 ON public.chat_direct_conversations(user1_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_user2 ON public.chat_direct_conversations(user2_id);`,

  // 5. chat_pinned_artifacts
  `CREATE TABLE IF NOT EXISTS public.chat_pinned_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES public.workspace_chat_channels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      pinned_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_pinned_artifacts_channel_id ON public.chat_pinned_artifacts(channel_id);`,

  // 6. Enable RLS
  `ALTER TABLE public.workspace_chat_channels ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.chat_direct_conversations ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.chat_pinned_artifacts ENABLE ROW LEVEL SECURITY;`,

  // 7. Table Grants
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_chat_channels TO authenticated, service_role;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_channel_members TO authenticated, service_role;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_direct_conversations TO authenticated, service_role;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_pinned_artifacts TO authenticated, service_role;`,

  // 8. RLS Policies - Channels
  `DROP POLICY IF EXISTS "chat_channels_select_policy" ON public.workspace_chat_channels;`,
  `CREATE POLICY "chat_channels_select_policy" ON public.workspace_chat_channels
      FOR SELECT TO authenticated
      USING (
          EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = workspace_chat_channels.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.status = 'ACTIVE'
          )
          AND (
              type = 'PUBLIC'
              OR EXISTS (
                  SELECT 1 FROM public.chat_channel_members ccm
                  WHERE ccm.channel_id = workspace_chat_channels.id
                    AND ccm.user_id = auth.uid()
              )
              OR EXISTS (
                  SELECT 1 FROM public.workspace_members wm
                  WHERE wm.workspace_id = workspace_chat_channels.workspace_id
                    AND wm.user_id = auth.uid()
                    AND wm.role IN ('OWNER', 'ADMIN')
                    AND wm.status = 'ACTIVE'
              )
          )
      );`,

  `DROP POLICY IF EXISTS "chat_channels_insert_policy" ON public.workspace_chat_channels;`,
  `CREATE POLICY "chat_channels_insert_policy" ON public.workspace_chat_channels
      FOR INSERT TO authenticated
      WITH CHECK (
          EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = workspace_chat_channels.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('OWNER', 'ADMIN', 'MANAGER')
                AND wm.status = 'ACTIVE'
          )
      );`,

  `DROP POLICY IF EXISTS "chat_channels_update_policy" ON public.workspace_chat_channels;`,
  `CREATE POLICY "chat_channels_update_policy" ON public.workspace_chat_channels
      FOR UPDATE TO authenticated
      USING (
          EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = workspace_chat_channels.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('OWNER', 'ADMIN')
                AND wm.status = 'ACTIVE'
          )
      );`,

  `DROP POLICY IF EXISTS "chat_channels_delete_policy" ON public.workspace_chat_channels;`,
  `CREATE POLICY "chat_channels_delete_policy" ON public.workspace_chat_channels
      FOR DELETE TO authenticated
      USING (
          EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = workspace_chat_channels.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('OWNER', 'ADMIN')
                AND wm.status = 'ACTIVE'
          )
      );`,

  `DROP POLICY IF EXISTS "chat_channels_service_policy" ON public.workspace_chat_channels;`,
  `CREATE POLICY "chat_channels_service_policy" ON public.workspace_chat_channels
      FOR ALL TO service_role USING (true) WITH CHECK (true);`,

  // RLS Policies - Direct Conversations
  `DROP POLICY IF EXISTS "chat_direct_conversations_select_policy" ON public.chat_direct_conversations;`,
  `CREATE POLICY "chat_direct_conversations_select_policy" ON public.chat_direct_conversations
      FOR SELECT TO authenticated
      USING (
          (auth.uid() = user1_id OR auth.uid() = user2_id)
          AND EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = chat_direct_conversations.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.status = 'ACTIVE'
          )
      );`,

  `DROP POLICY IF EXISTS "chat_direct_conversations_insert_policy" ON public.chat_direct_conversations;`,
  `CREATE POLICY "chat_direct_conversations_insert_policy" ON public.chat_direct_conversations
      FOR INSERT TO authenticated
      WITH CHECK (
          (auth.uid() = user1_id OR auth.uid() = user2_id)
          AND EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = chat_direct_conversations.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.status = 'ACTIVE'
          )
      );`,

  `DROP POLICY IF EXISTS "chat_direct_conversations_service_policy" ON public.chat_direct_conversations;`,
  `CREATE POLICY "chat_direct_conversations_service_policy" ON public.chat_direct_conversations
      FOR ALL TO service_role USING (true) WITH CHECK (true);`,

  // 9. Backfill Default #general Channels
  `DO $$
  DECLARE
      ws RECORD;
  BEGIN
      FOR ws IN SELECT id, owner_id FROM public.workspaces LOOP
          IF NOT EXISTS (SELECT 1 FROM public.workspace_chat_channels WHERE workspace_id = ws.id AND is_default = true) THEN
              INSERT INTO public.workspace_chat_channels (
                  workspace_id,
                  nexconn_channel_id,
                  name,
                  description,
                  type,
                  is_default,
                  created_by_id
              ) VALUES (
                  ws.id,
                  'spark_chan_' || substring(replace(ws.id::text, '-', ''), 1, 8) || '_general',
                  'general',
                  'General workspace announcements and open team discussions',
                  'PUBLIC',
                  true,
                  ws.owner_id
              );
          END IF;
      END LOOP;
  END $$;`
];

async function run() {
  console.log('Applying Module 03 Database Migration statements sequentially...');

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      await prisma.$executeRawUnsafe(stmt);
      console.log(`[PASS] Statement ${i + 1}/${statements.length} executed successfully.`);
    }

    console.log('[SUCCESS] All Module 03 Migration statements executed successfully!');

    // Verify created tables
    const channels = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('workspace_chat_channels', 'chat_channel_members', 'chat_direct_conversations', 'chat_pinned_artifacts');
    `);
    console.log('[VERIFY] Created Tables:', channels.map(c => c.table_name));

    // Verify backfilled default channels
    const defaultChannels = await prisma.$queryRawUnsafe(`
      SELECT id, workspace_id, nexconn_channel_id, name, is_default 
      FROM public.workspace_chat_channels 
      WHERE is_default = true;
    `);
    console.log(`[VERIFY] Backfilled Default Channels: ${defaultChannels.length} workspace(s) configured with #general.`);
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
