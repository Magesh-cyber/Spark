-- ==============================================================================
-- SPARK Module 02: Workspaces, Members, Invitations, Settings & Multi-Tenancy
-- Migration: 20261115_module_02_workspaces
-- ==============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'ORGANIZATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'GUEST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    type "WorkspaceType" NOT NULL DEFAULT 'ORGANIZATION',
    avatar_url TEXT,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_type ON public.workspaces(type);

-- 3. Create workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    status "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON public.workspace_members(status);

-- 4. Create workspace_invitations table
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_email ON public.workspace_invitations(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_at ON public.workspace_invitations(expires_at);

-- 5. Create workspace_settings table
CREATE TABLE IF NOT EXISTS public.workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
    default_member_role "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    allow_member_invitations BOOLEAN NOT NULL DEFAULT true,
    allow_guest_access BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable RLS on all 4 tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- 7. Grant Table Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_invitations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_settings TO authenticated, service_role;

-- 8. Row Level Security Policies
-- Workspaces
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces" ON public.workspaces
    FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
CREATE POLICY "Owners and admins can update workspaces" ON public.workspaces
    FOR UPDATE TO authenticated
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('OWNER', 'ADMIN')
            AND wm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "Authenticated can insert workspaces" ON public.workspaces;
CREATE POLICY "Authenticated can insert workspaces" ON public.workspaces
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces" ON public.workspaces
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- Workspace Members
DROP POLICY IF EXISTS "Members can view co-members" ON public.workspace_members;
CREATE POLICY "Members can view co-members" ON public.workspace_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members my_mem
            WHERE my_mem.workspace_id = public.workspace_members.workspace_id
            AND my_mem.user_id = auth.uid()
            AND my_mem.status = 'ACTIVE'
        ) OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Admins and owners can update members" ON public.workspace_members;
CREATE POLICY "Admins and owners can update members" ON public.workspace_members
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('OWNER', 'ADMIN')
            AND wm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "Admins and owners can delete members" ON public.workspace_members;
CREATE POLICY "Admins and owners can delete members" ON public.workspace_members
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('OWNER', 'ADMIN')
            AND wm.status = 'ACTIVE'
        )
    );

-- Workspace Invitations
DROP POLICY IF EXISTS "Members can view invitations" ON public.workspace_invitations;
CREATE POLICY "Members can view invitations" ON public.workspace_invitations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invitations.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('OWNER', 'ADMIN', 'MANAGER')
            AND wm.status = 'ACTIVE'
        )
    );

-- Workspace Settings
DROP POLICY IF EXISTS "Members can view settings" ON public.workspace_settings;
CREATE POLICY "Members can view settings" ON public.workspace_settings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_settings.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.status = 'ACTIVE'
        )
    );

-- 9. Automatic Personal Workspace Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_workspace_id UUID;
  v_slug TEXT;
BEGIN
  v_full_name := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''), 'SPARK User');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF v_first_name = '' THEN
    v_first_name := 'Personal';
  END IF;

  -- 1. Insert or update public.users
  INSERT INTO public.users (id, email, full_name, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    v_full_name,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- 2. Create personal workspace if not already present
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE owner_id = new.id AND type = 'PERSONAL'
  ) THEN
    v_workspace_id := gen_random_uuid();
    v_slug := 'personal-' || substring(new.id::text from 1 for 8);

    IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_slug) THEN
      v_slug := 'personal-' || substring(new.id::text from 1 for 13);
    END IF;

    INSERT INTO public.workspaces (
      id, name, slug, description, type, owner_id, created_at, updated_at
    ) VALUES (
      v_workspace_id,
      v_first_name || '''s Personal Workspace',
      v_slug,
      'Your private workspace for personal tasks, notes, and projects.',
      'PERSONAL',
      new.id,
      now(),
      now()
    );

    INSERT INTO public.workspace_members (
      id, workspace_id, user_id, role, status, joined_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_workspace_id,
      new.id,
      'OWNER',
      'ACTIVE',
      now(),
      now()
    ) ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO public.workspace_settings (
      id, workspace_id, default_member_role, allow_member_invitations, allow_guest_access, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_workspace_id,
      'MEMBER',
      false,
      false,
      now(),
      now()
    ) ON CONFLICT (workspace_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
