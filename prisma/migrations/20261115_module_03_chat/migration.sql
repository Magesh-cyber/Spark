-- ==============================================================================
-- SPARK Module 03: Real-Time Team Communication & Channels
-- Migration: 20261115_module_03_chat
-- ==============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE "ChatChannelType" AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create workspace_chat_channels table
CREATE TABLE IF NOT EXISTS public.workspace_chat_channels (
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
);

CREATE INDEX IF NOT EXISTS idx_workspace_chat_channels_workspace_id ON public.workspace_chat_channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_chat_channels_nexconn_id ON public.workspace_chat_channels(nexconn_channel_id);

-- 3. Create chat_channel_members table (for private channels)
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.workspace_chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chat_channel_member UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON public.chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON public.chat_channel_members(user_id);

-- 4. Create chat_direct_conversations table
CREATE TABLE IF NOT EXISTS public.chat_direct_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chat_direct_conversation UNIQUE (workspace_id, user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_workspace_id ON public.chat_direct_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_user1 ON public.chat_direct_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_chat_direct_conversations_user2 ON public.chat_direct_conversations(user2_id);

-- 5. Create chat_pinned_artifacts table
CREATE TABLE IF NOT EXISTS public.chat_pinned_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.workspace_chat_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    pinned_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pinned_artifacts_channel_id ON public.chat_pinned_artifacts(channel_id);

-- 6. Enable RLS on all 4 tables
ALTER TABLE public.workspace_chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_pinned_artifacts ENABLE ROW LEVEL SECURITY;

-- 7. Grant Table Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_chat_channels TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_channel_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_direct_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_pinned_artifacts TO authenticated, service_role;

-- 8. Row Level Security Policies

-- Channels: Select
DROP POLICY IF EXISTS "chat_channels_select_policy" ON public.workspace_chat_channels;
CREATE POLICY "chat_channels_select_policy" ON public.workspace_chat_channels
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
    );

-- Channels: Insert (Admin / Owner / Manager)
DROP POLICY IF EXISTS "chat_channels_insert_policy" ON public.workspace_chat_channels;
CREATE POLICY "chat_channels_insert_policy" ON public.workspace_chat_channels
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_chat_channels.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('OWNER', 'ADMIN', 'MANAGER')
              AND wm.status = 'ACTIVE'
        )
    );

-- Channels: Update (Admin / Owner)
DROP POLICY IF EXISTS "chat_channels_update_policy" ON public.workspace_chat_channels;
CREATE POLICY "chat_channels_update_policy" ON public.workspace_chat_channels
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_chat_channels.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('OWNER', 'ADMIN')
              AND wm.status = 'ACTIVE'
        )
    );

-- Channels: Delete (Admin / Owner)
DROP POLICY IF EXISTS "chat_channels_delete_policy" ON public.workspace_chat_channels;
CREATE POLICY "chat_channels_delete_policy" ON public.workspace_chat_channels
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_chat_channels.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('OWNER', 'ADMIN')
              AND wm.status = 'ACTIVE'
        )
    );

-- Service role bypass
DROP POLICY IF EXISTS "chat_channels_service_policy" ON public.workspace_chat_channels;
CREATE POLICY "chat_channels_service_policy" ON public.workspace_chat_channels
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Direct Conversations: Select & Insert
DROP POLICY IF EXISTS "chat_direct_conversations_select_policy" ON public.chat_direct_conversations;
CREATE POLICY "chat_direct_conversations_select_policy" ON public.chat_direct_conversations
    FOR SELECT TO authenticated
    USING (
        (auth.uid() = user1_id OR auth.uid() = user2_id)
        AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = chat_direct_conversations.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "chat_direct_conversations_insert_policy" ON public.chat_direct_conversations;
CREATE POLICY "chat_direct_conversations_insert_policy" ON public.chat_direct_conversations
    FOR INSERT TO authenticated
    WITH CHECK (
        (auth.uid() = user1_id OR auth.uid() = user2_id)
        AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = chat_direct_conversations.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "chat_direct_conversations_service_policy" ON public.chat_direct_conversations;
CREATE POLICY "chat_direct_conversations_service_policy" ON public.chat_direct_conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Backfill Default Channels: Ensure all existing workspaces have a #general channel
DO $$
DECLARE
    ws RECORD;
    gen_chan_id UUID;
BEGIN
    FOR ws IN SELECT id, owner_id FROM public.workspaces LOOP
        -- Check if workspace already has a default channel
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
END $$;

