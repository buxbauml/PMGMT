-- PROJ-2: Workspace Management - Database Schema
-- Run this migration in Supabase SQL Editor

-- ============================================================
-- 1. PROFILES TABLE (auto-created on signup via trigger)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  last_active_workspace_id UUID, -- will add FK after workspaces table exists
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users can read any profile (needed for member lists), update only own
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_workspace ON public.profiles(last_active_workspace_id);

-- ============================================================
-- 2. WORKSPACES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 50),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Add FK from profiles to workspaces now that workspaces table exists
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_last_active_workspace
  FOREIGN KEY (last_active_workspace_id)
  REFERENCES public.workspaces(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

-- ============================================================
-- 3. WORKSPACE MEMBERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);

-- ============================================================
-- 4. WORKSPACE INVITATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL
);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_email ON public.workspace_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON public.workspace_invitations(status);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by ON public.workspace_invitations(invited_by);

-- ============================================================
-- 5. RLS POLICIES - WORKSPACES
-- ============================================================

-- Members can view workspaces they belong to
CREATE POLICY "Members can view workspace"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Any authenticated user can create a workspace
CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owner can update workspace
CREATE POLICY "Owner can update workspace"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

-- Only owner can delete workspace
CREATE POLICY "Owner can delete workspace"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================
-- 6. RLS POLICIES - WORKSPACE MEMBERS
-- ============================================================

-- Members can view other members in their workspaces
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members AS my_membership
      WHERE my_membership.workspace_id = workspace_members.workspace_id
        AND my_membership.user_id = auth.uid()
    )
  );

-- Owner/admin can insert members (used when accepting invites via API)
-- We handle permission checks in the API layer for invite acceptance
CREATE POLICY "Service can insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    -- Allow if user is adding themselves (invite acceptance)
    user_id = auth.uid()
    OR
    -- Allow if requester is owner/admin of the workspace
    EXISTS (
      SELECT 1 FROM public.workspace_members AS mgr
      WHERE mgr.workspace_id = workspace_members.workspace_id
        AND mgr.user_id = auth.uid()
        AND mgr.role IN ('owner', 'admin')
    )
  );

-- Members can update their own record (last_accessed_at)
-- Owner/admin can update any member's role
CREATE POLICY "Members can update own or admin can update others"
  ON public.workspace_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members AS mgr
      WHERE mgr.workspace_id = workspace_members.workspace_id
        AND mgr.user_id = auth.uid()
        AND mgr.role IN ('owner', 'admin')
    )
  );

-- Owner/admin can remove members (not themselves handled in API)
CREATE POLICY "Owner/admin can remove members"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members AS mgr
      WHERE mgr.workspace_id = workspace_members.workspace_id
        AND mgr.user_id = auth.uid()
        AND mgr.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 7. RLS POLICIES - WORKSPACE INVITATIONS
-- ============================================================

-- Owner/admin can view invitations for their workspaces
CREATE POLICY "Owner/admin can view invitations"
  ON public.workspace_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
    OR
    -- Users can view invitations sent to their email (for accept page)
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Owner/admin can create invitations
CREATE POLICY "Owner/admin can create invitations"
  ON public.workspace_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Owner/admin can update invitations (cancel/expire)
CREATE POLICY "Owner/admin can update invitations"
  ON public.workspace_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
    OR
    -- Invited user can update (accept) their own invitation
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Owner/admin can delete invitations
CREATE POLICY "Owner/admin can delete invitations"
  ON public.workspace_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_invitations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 8. UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
